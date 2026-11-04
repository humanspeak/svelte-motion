import { MotionDomProjectionAdapter } from '$lib/utils/motionDomProjection'
import { render } from '@testing-library/svelte'
import { visualElementStore, type IProjectionNode, type LayoutUpdateData } from 'motion-dom'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PresenceSiblingsHarness from './__tests__/PresenceSiblingsHarness.svelte'

// Clone-path exits finish 100ms after they start (the set-up of
// `__tests__/onExitCompleteTiming.svelte.spec.ts`, but not at once: a
// completion within a frame of its exit's start would land in observer
// frames the start woke up). Owned exits run their 50ms tween on
// motion-dom's frameloop.
vi.mock('motion', () => ({
    animate: vi.fn(() => ({
        finished: new Promise((resolve) => setTimeout(resolve, 100)),
        stop() {}
    }))
}))

/**
 * Plan 015b: which `layout` siblings snapshot around an `AnimatePresence`
 * change, against upstream's render model.
 *
 * React re-renders the component whose state changed, and every `motion.*`
 * in it snapshots before the DOM changes (`MeasureLayout.tsx:149-204` @
 * v14.7.1). So removing, adding or popping an item animates the other items,
 * even in separate `AnimatePresence` boundaries, and `layout` nodes after
 * the list (a footer). When an exit completes, only that `AnimatePresence`
 * re-renders (`AnimatePresence/index.tsx:244`); its other children re-render
 * through their new presence context (`PresenceChild.tsx:91-98`,
 * `use-presence.ts:40-43`, nested boundaries via `index.tsx:58`), a
 * `LayoutGroup` around it re-renders through `forceRender`
 * (`index.tsx:206`, `group.ts:26-33`), and everything else snaps.
 *
 * jsdom has no layout, so boxes are laid out here from the DOM: items are
 * stacked 70px apart from y=100 (a popped item or an exit clone takes no
 * slot, a sync placeholder does), the footer sits below the last slot, the
 * header at y=0 and `#inner` 5px inside item 2. Case 4 (the exiting
 * element's own snapshot) is plan 015c's.
 */

const SLOT = 70
const TOP = 100

type Update = { snapshot: number; layout: number }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/**
 * Pops, adds and removals are checked within 120ms; popLayout cases use a 2s
 * owned exit so its completion (cases 5 and 10) stays out of that window.
 */
const settle = async (ms = 120) => {
    await tick()
    await sleep(ms)
    await tick()
}

const rect = (top: number, height = 60, left = 10, width = 150) =>
    ({
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON() {}
    }) as DOMRect

/** Where each `data-box` was last laid out in flow, for popped items and clones. */
const lastTop = new Map<string, number>()
const reads = new Map<string, number>()

const inFlow = () =>
    Array.from(document.querySelectorAll<HTMLElement>('#list li')).filter(
        (li) => !li.hasAttribute('data-motion-pop-id') && !li.hasAttribute('data-clone')
    )

function layOut(element: HTMLElement): DOMRect {
    if (!element.isConnected) return rect(0, 0, 0, 0)
    const box = element.dataset.box
    if (element.id) reads.set(element.id, (reads.get(element.id) ?? 0) + 1)
    if (element.closest('#list') && element.tagName === 'LI') {
        const index = inFlow().indexOf(element)
        if (index >= 0) {
            const top = TOP + SLOT * index
            if (box) lastTop.set(box, top)
            return rect(top)
        }
        return rect(box ? (lastTop.get(box) ?? TOP) : TOP)
    }
    if (box === 'footer') return rect(TOP + SLOT * inFlow().length, 40)
    if (box === 'header') return rect(0, 40)
    if (box === 'inner') {
        const item2 = document.querySelector<HTMLElement>('#item-2:not([data-clone])')
        return rect((item2 ? layOut(item2).top : TOP) + 5, 20, 20, 100)
    }
    return rect(0, 0, 0, 0)
}

const projectionOf = (id: string) =>
    visualElementStore.get(document.getElementById(id)!)!.projection! as IProjectionNode

/** Every `didUpdate` of the named nodes, as snapshot/layout tops. */
function listen(ids: string[]) {
    const updates: Record<string, Update[]> = {}
    for (const id of ids) {
        updates[id] = []
        projectionOf(id).addEventListener('didUpdate', ({ layout, snapshot }: LayoutUpdateData) => {
            updates[id].push({ snapshot: snapshot.layoutBox.y.min, layout: layout.y.min })
        })
    }
    return updates
}

type Props = Record<string, unknown>

async function mount(props: Props) {
    const result = render(PresenceSiblingsHarness, { props })
    await settle(150)
    let current = props
    return {
        ...result,
        update: async (next: Props) => {
            current = { ...current, ...next }
            await result.rerender(current)
            await tick()
        }
    }
}

describe('layout siblings around AnimatePresence changes (plan 015b)', () => {
    beforeEach(() => {
        vi.useRealTimers()
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        )
        HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
            return layOut(this)
        }
        // jsdom has no WAAPI; the motion container's layout capture calls it.
        ;(Element.prototype as unknown as { getAnimations: () => Animation[] }).getAnimations =
            () => []
        lastTop.clear()
        reads.clear()
    })

    afterEach(() => {
        delete (HTMLElement.prototype as Partial<HTMLElement>).getBoundingClientRect
        delete (Element.prototype as Partial<Element>).getAnimations
        document.head.querySelectorAll('style').forEach((style) => style.remove())
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    // 1. RED (owned): popping item 1 out of flow moves item 2 up a slot.
    it('1: owned popLayout, item 1 exits: item 2 animates once from its old slot', async () => {
        const { update } = await mount({ mode: 'popLayout', slow: true })
        const updates = listen(['item-2'])

        await update({ remove: [1] })
        await settle()

        expect(updates['item-2']).toEqual([{ snapshot: TOP + SLOT, layout: TOP }])
    })

    // 2. RED (both paths): the footer after the list animates (part D); the
    // header before it is never touched (GUARD).
    for (const clone of [false, true]) {
        it(`2: ${clone ? 'clone' : 'owned'} popLayout, item 1 exits: the footer animates, the header is untouched`, async () => {
            const { update } = await mount({ mode: 'popLayout', clone, slow: true })
            const updates = listen(['footer', 'header'])
            reads.clear()

            await update({ remove: [1] })
            await settle()

            expect(updates.header, 'header didUpdate').toEqual([])
            expect(reads.get('header') ?? 0, 'header reads').toBe(0)
            expect(updates.footer).toEqual([{ snapshot: TOP + 3 * SLOT, layout: TOP + 2 * SLOT }])
        })
    }

    // 3. RED (clone): an item added at the end pushes the footer down.
    it('3: clone, addLast: the footer animates down a slot', async () => {
        const { update } = await mount({ mode: 'popLayout', clone: true })
        const updates = listen(['footer'])

        await update({ addLast: true })
        await settle()

        expect(updates.footer).toEqual([{ snapshot: TOP + 3 * SLOT, layout: TOP + 4 * SLOT }])
    })

    // 4. RED (plan 015c): the exiting element's own snapshot. Item 1 exits
    // while `{#each}` prepends item 0 in the same update, which pushes item 1
    // down a slot before item 1's pre-update effect runs. Upstream snapshots
    // before React commits anything (`MeasureLayout.tsx:149-204` @ v14.7.1),
    // so item 1's snapshot is its pre-insert box.
    it('4: owned popLayout, item 1 exits as item 0 is prepended: item 1 snapshots its pre-insert box', async () => {
        const { update } = await mount({ mode: 'popLayout', slow: true })
        const updates = listen(['item-1'])

        await update({ remove: [1], addFirst: true })
        await settle()

        expect(updates['item-1'].length).toBeGreaterThan(0)
        expect(updates['item-1'][0].snapshot).toBe(TOP)
    })

    // 5. Owned sync completion.
    it('5: owned sync completion, no LayoutGroup: item 2 snaps (GUARD)', async () => {
        const { update } = await mount({ mode: 'sync' })
        const updates = listen(['item-2'])

        await update({ remove: [1] })
        await settle(300)

        expect(document.getElementById('item-1')).toBeNull()
        expect(updates['item-2']).toEqual([])
    })

    it('5: owned sync completion, LayoutGroup: item 2 animates (GUARD)', async () => {
        const { update } = await mount({ mode: 'sync', layoutGroup: true })
        const updates = listen(['item-2'])

        await update({ remove: [1] })
        await settle(300)

        expect(document.getElementById('item-1')).toBeNull()
        // Item 1's own presence change dirties the whole group when its exit
        // starts (`group.ts`), a pass in which nothing has moved yet.
        const moves = updates['item-2'].filter(({ snapshot, layout }) => snapshot !== layout)
        expect(moves).toEqual([{ snapshot: TOP + SLOT, layout: TOP }])
    })

    // 6. Clone sync completion, no LayoutGroup.
    it('6: clone sync completion: a footer outside the list parent snaps (GUARD)', async () => {
        const { update } = await mount({ mode: 'sync', clone: true })
        const updates = listen(['footer'])

        // The exit's start re-renders the list's owner, footer included, as
        // upstream does: an update is allowed, but the footer doesn't move.
        await update({ remove: [1] })
        await settle(40)
        expect(document.querySelector('[data-clone]')).not.toBeNull()
        const atStart = updates.footer.length
        for (const { snapshot, layout } of updates.footer) expect(snapshot).toBe(layout)

        // The completion re-renders only the AnimatePresence: nothing at all.
        await settle(300)
        expect(document.querySelector('[data-clone]')).toBeNull()
        expect(updates.footer.slice(atStart)).toEqual([])
    })

    it('6: clone sync completion, footerInList: the footer snaps (RED)', async () => {
        const { update } = await mount({ mode: 'sync', clone: true, footerInList: true })
        const updates = listen(['footer'])

        await update({ remove: [1] })
        await settle(300)

        expect(document.querySelector('[data-clone]')).toBeNull()
        expect(updates.footer).toEqual([])
    })

    it('6 (N1): clone sync completion, then addLast: the footer slides from its post-completion box (RED)', async () => {
        const { update } = await mount({ mode: 'sync', clone: true })
        await update({ remove: [1] })
        await settle(300)
        expect(document.querySelector('[data-clone]')).toBeNull()
        const updates = listen(['footer'])

        await update({ addLast: true })
        await settle()

        expect(updates.footer).toEqual([{ snapshot: TOP + 2 * SLOT, layout: TOP + 3 * SLOT }])
    })

    it('6 (M5): clone sync, the only item completes, then addLast: the footer slides from its post-completion box (RED)', async () => {
        const { update } = await mount({ mode: 'sync', clone: true, items: 1 })
        await update({ remove: [1] })
        await settle(300)
        expect(document.querySelector('#list li')).toBeNull()
        const updates = listen(['footer'])

        await update({ addLast: true })
        await settle()

        expect(updates.footer).toEqual([{ snapshot: TOP, layout: TOP + SLOT }])
    })

    // 7. GUARD: a sibling in the same AnimatePresence re-renders on completion.
    it('7: clone sync completion: item 2, in the same AnimatePresence, animates (GUARD)', async () => {
        const { update } = await mount({ mode: 'sync', clone: true })
        const updates = listen(['item-2'])

        await update({ remove: [1] })
        await settle(300)

        expect(document.querySelector('[data-clone]')).toBeNull()
        expect(updates['item-2']).toEqual([{ snapshot: TOP + SLOT, layout: TOP }])
    })

    // 8. A gated committer inside the boundary still re-renders its
    // descendants (`index.tsx:58` → `use-presence.ts:40-43`).
    it('8: clone, nested + gateItem2, sync completion: #inner animates (RED)', async () => {
        const { update } = await mount({
            mode: 'sync',
            clone: true,
            nested: true,
            gateItem2: true
        })
        const updates = listen(['inner', 'item-2'])

        await update({ remove: [1] })
        await settle(300)

        expect(document.querySelector('[data-clone]')).toBeNull()
        expect(updates['item-2']).toEqual([])
        expect(updates.inner).toEqual([{ snapshot: TOP + SLOT + 5, layout: TOP + 5 }])
    })

    it('8: owned, nested + gateItem2, sync completion: #inner snaps (GUARD)', async () => {
        const { update } = await mount({ mode: 'sync', nested: true, gateItem2: true })
        const updates = listen(['inner', 'item-2'])

        await update({ remove: [1] })
        await settle(300)

        expect(document.getElementById('item-1')).toBeNull()
        expect(updates['item-2']).toEqual([])
        expect(updates.inner).toEqual([])
    })

    // 9. GUARD: an unchanged layoutDependency takes no snapshot.
    for (const clone of [false, true]) {
        it(`9: ${clone ? 'clone' : 'owned'} popLayout: item 2 with an unchanged layoutDependency has no didUpdate (GUARD)`, async () => {
            const { update } = await mount({
                mode: 'popLayout',
                clone,
                gateItem2: true,
                slow: true
            })
            const updates = listen(['item-2'])

            await update({ remove: [1] })
            await settle()

            expect(updates['item-2']).toEqual([])
        })
    }

    // 10. RED: the marker survives Svelte's teardown order, so a real owned
    // completion is classified (item 2 refreshes silently: the snap).
    it('10: a real owned completion is classified exit-complete', async () => {
        const { update } = await mount({ mode: 'sync' })
        const silent: string[] = []
        const refreshLayout = Object.getOwnPropertyDescriptor(
            MotionDomProjectionAdapter.prototype,
            'refreshLayout'
        )!.value as (
            this: MotionDomProjectionAdapter,
            options?: { silent?: boolean }
        ) => ReturnType<MotionDomProjectionAdapter['refreshLayout']>
        vi.spyOn(MotionDomProjectionAdapter.prototype, 'refreshLayout').mockImplementation(
            function (this: MotionDomProjectionAdapter, options) {
                if (options?.silent) {
                    const element = (this as unknown as { element: HTMLElement | null }).element
                    if (element?.id) silent.push(element.id)
                }
                return refreshLayout.call(this, options)
            }
        )

        await update({ remove: [1] })
        await settle(300)

        expect(document.getElementById('item-1')).toBeNull()
        expect(silent).toContain('item-2')
    })

    // A1.1 GUARD: part D runs on an add, never for the initial render.
    for (const clone of [false, true]) {
        it(`A1.1: ${clone ? 'clone' : 'owned'}, initial render of N items and a footer: no follower seed`, async () => {
            const seed = vi.spyOn(MotionDomProjectionAdapter, 'seedFollowingLayout')
            await mount({ mode: 'popLayout', clone, items: 5 })
            const updates = listen(['footer'])
            await settle()

            const list = document.getElementById('list')!
            const perParent = seed.mock.calls.filter(([parent]) => parent === list).length
            expect(perParent).toBeLessThanOrEqual(1)
            expect(updates.footer).toEqual([])
        })
    }
})
