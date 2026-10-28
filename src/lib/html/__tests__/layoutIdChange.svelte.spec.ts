import { layoutIdRegistry } from '$lib/utils/layoutId'
import { render } from '@testing-library/svelte'
import { visualElementStore, type IProjectionNode } from 'motion-dom'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LayoutIdChangeHarness from './LayoutIdChangeHarness.svelte'
import LayoutIdGalleryHarness from './LayoutIdGalleryHarness.svelte'

/**
 * #1411 (Motion 14.7.1): a motion element's `layoutId` can change after it
 * mounts. Its projection node must leave the old `layoutId`'s stack and join
 * the new one, as if it had mounted with the new id. Port of upstream
 * `packages/framer-motion/src/projection/__tests__/layout-id-change.test.tsx`
 * @ v14.7.1 (commits 7f85889ed, 21bdf13d3, 32abe31f7, c3b7305ba, f58782f0e,
 * fd97ac411, 518b90659).
 *
 * Nodes are compared by identity. Where upstream asserts synchronously right
 * after `rerender`, these assert after `await tick()`: that is when Svelte's
 * pre-update effects (upstream's `getSnapshotBeforeUpdate`) have run.
 *
 * Not ported: "keeps layoutAnchor in sync" (plan 007), "takes a layoutId back
 * from an exiting element" (svelte-motion's exiting elements are detached
 * clones without a projection node), the StrictMode variants and the
 * `layoutCrossfade={false}` variants (not a svelte-motion prop).
 */

type Item = { key: string; layoutId?: string; layout?: boolean; layoutDependency?: unknown }

const frames = async (count: number) => {
    for (let i = 0; i < count; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
    await tick()
}

const element = (id: string) => document.getElementById(id) as HTMLElement
const getNode = (el: HTMLElement) => visualElementStore.get(el)!.projection! as IProjectionNode

const resetRegistry = (...ids: string[]) => {
    for (const id of ids) layoutIdRegistry.consume(id)
}

/**
 * JSDOM has no layout, so `getBoundingClientRect` reads each element's box
 * from `boxes`, keyed by its `data-box` attribute or else its id. motion-dom
 * discards a zero-size snapshot (`updateSnapshot`), so an element without a
 * box would never have one to resume from.
 */
const mockBoxes = (boxes: Record<string, [number, number, number, number]>) =>
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement
    ) {
        const [x, y, width, height] = boxes[this.dataset.box ?? this.id] ?? [0, 0, 0, 0]
        return {
            x,
            y,
            left: x,
            top: y,
            width,
            height,
            right: x + width,
            bottom: y + height,
            toJSON() {}
        }
    })

/** JSDOM has no ResizeObserver; `layout` elements observe their own size. */
const stubResizeObserver = () =>
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        }
    )

describe('changing layoutId after mount (#1411)', () => {
    beforeEach(() => {
        vi.useRealTimers()
        stubResizeObserver()
        mockBoxes({ a: [0, 50, 100, 100], b: [300, 50, 100, 100], x: [0, 0, 100, 50] })
        resetRegistry(
            'initial',
            'shared',
            'added',
            'joined',
            'a',
            'b',
            'group-a',
            'group-b',
            'selected',
            'other',
            'underline',
            'fresh'
        )
    })
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    const mount = async (items: Item[], group?: string) => {
        const result = render(LayoutIdChangeHarness, { props: { items, group } })
        await frames(2)
        return {
            ...result,
            update: async (next: Item[]) => {
                await result.rerender({ items: next, group })
                await tick()
            }
        }
    }

    it("moves the node to the new layoutId's stack", async () => {
        const { update } = await mount([{ key: 'x', layoutId: 'initial' }])
        const node = getNode(element('x'))
        const { sharedNodes } = node.root!

        expect(sharedNodes.get('initial')!.lead === node).toBe(true)

        await update([{ key: 'x', layoutId: 'shared' }])
        await frames(1)

        expect(node.getStack() === sharedNodes.get('shared')).toBe(true)
        expect(node.getStack()!.lead === node).toBe(true)
        expect((sharedNodes.get('initial')?.members ?? []).includes(node)).toBe(false)
    })

    it('can add and remove a layoutId', async () => {
        const { update } = await mount([{ key: 'x', layout: true }])
        const node = getNode(element('x'))
        const { sharedNodes } = node.root!

        await update([{ key: 'x', layout: true, layoutId: 'added' }])
        await frames(1)
        expect(sharedNodes.get('added')?.lead === node).toBe(true)

        await update([{ key: 'x', layout: true }])
        await frames(1)
        expect((sharedNodes.get('added')?.members ?? []).includes(node)).toBe(false)
    })

    // A node that's already on screen takes over the new layoutId instantly,
    // rather than animating from the lead as a node mounting with it would.
    // The lead is hidden, even if it doesn't re-render (constant
    // layoutDependency).
    it.each([undefined, 1])(
        "takes over the new layoutId's lead instantly (layoutDependency %s)",
        async (layoutDependency) => {
            const items = (id: string): Item[] => [
                { key: 'a', layoutId: id },
                { key: 'b', layoutId: 'shared', layoutDependency }
            ]
            const { update } = await mount(items('initial'))
            const nodeA = getNode(element('a'))
            const nodeB = getNode(element('b'))
            await frames(1)

            expect(nodeB.getStack()!.lead === nodeB).toBe(true)

            await update(items('shared'))

            const stack = nodeA.root!.sharedNodes.get('shared')!
            expect(stack.lead === nodeA).toBe(true)
            expect(stack.prevLead === nodeB).toBe(true)
            expect(nodeA.resumeFrom).toBeUndefined()

            await frames(1)
            expect(nodeA.currentAnimation).toBeUndefined()
            expect(element('a').style.visibility).not.toBe('hidden')
            expect(element('b').style.visibility).toBe('hidden')
        }
    )

    it('namespaces the new layoutId by its LayoutGroup', async () => {
        const { update } = await mount([{ key: 'x', layoutId: 'a' }], 'group')
        const node = getNode(element('x'))
        const { sharedNodes } = node.root!

        await update([{ key: 'x', layoutId: 'b' }])
        await frames(1)

        expect(sharedNodes.get('group-b')?.lead === node).toBe(true)
        expect((sharedNodes.get('group-a')?.members ?? []).includes(node)).toBe(false)
    })

    // Upstream runs this in StrictMode, which double-invokes effects. Svelte
    // has no StrictMode, so switch back and forth instead: every switch must
    // leave the previous stack before joining the next.
    it('joins the new stack once', async () => {
        const { update } = await mount([{ key: 'x', layoutId: 'a' }])
        const node = getNode(element('x'))

        for (const id of ['b', 'a', 'b']) {
            await update([{ key: 'x', layoutId: id }])
            await frames(1)
        }

        const { members } = node.root!.sharedNodes.get('b')!
        expect(members.filter((member: unknown) => member === node).length).toBe(1)
        expect((node.root!.sharedNodes.get('a')?.members ?? []).includes(node)).toBe(false)
    })

    // Upstream sets `layoutCrossfade={false}`, which svelte-motion doesn't
    // have: this guards the takeover-hide path instead. An element that keeps
    // rendering without the layoutId, or moves to another layoutId, must stay
    // visible, whichever order the two update in.
    it.each([
        ['a', 'b'],
        ['b', 'a']
    ])(
        'keeps an element visible after its layoutId moves to another (%s to %s)',
        async (from, to) => {
            const items = (selected: string, other?: string): Item[] =>
                ['a', 'b'].map((id) => ({
                    key: id,
                    layout: true,
                    layoutId: selected === id ? 'selected' : other
                }))
            const { update } = await mount(items(from))
            const prev = element(from)

            await update(items(to))
            await frames(1)
            const visible = [prev.style.visibility]

            await update(items(from))
            await frames(1)
            await update(items(to, 'other'))
            await frames(1)
            visible.push(prev.style.visibility)

            expect(visible).not.toContain('hidden')
        }
    )

    // Without `layout` or `drag`, upstream's MeasureLayout only renders while
    // there's a layoutId, but the node must still join and leave stacks.
    it('joins and leaves a stack without the layout prop', async () => {
        const { update } = await mount([{ key: 'x' }])
        const node = getNode(element('x'))
        const { sharedNodes } = node.root!

        await update([{ key: 'x', layoutId: 'joined' }])
        await frames(1)
        expect(sharedNodes.get('joined')?.lead === node).toBe(true)

        await update([{ key: 'x' }])
        await frames(1)
        expect((sharedNodes.get('joined')?.members ?? []).includes(node)).toBe(false)
    })

    // Amendment A1 guard: only a node that takes over a lead still on screen
    // runs a mount-time update pass. A plain mount (no lead to resume from)
    // starts no update, exactly as before.
    it('a mount with no live resumeFrom runs no extra update pass', async () => {
        const { update } = await mount([{ key: 'a' }])
        const root = getNode(element('a')).root!
        const startUpdate = vi.spyOn(root, 'startUpdate')

        await update([{ key: 'a' }, { key: 'x', layoutId: 'fresh' }])
        await frames(2)

        expect(getNode(element('x')).resumeFrom).toBeUndefined()
        expect(startUpdate).not.toHaveBeenCalled()
    })

    // Tabs: layoutId={selected ? 'underline' : undefined}. The id moves from
    // one element to another in the same update, so the new holder animates
    // from the old one, whichever order the two update in. Both stay visible.
    it.each([
        ['a', 'b', true],
        ['b', 'a', true],
        ['a', 'b', undefined],
        ['b', 'a', undefined]
    ])('animates the layoutId from %s to %s (layout %s)', async (from, to, layout) => {
        const items = (selected: string): Item[] =>
            ['a', 'b'].map((id) => ({
                key: id,
                layout,
                layoutId: selected === id ? 'underline' : undefined
            }))
        const { update } = await mount(items(from))
        await frames(1)
        const prev = getNode(element(from))
        const next = getNode(element(to))

        await update(items(to))

        expect(next.getStack()?.lead === next).toBe(true)
        // Upstream reads `resumeFrom` synchronously after the commit. Here the
        // update pass has already run by the time `rerender` resolves, and it
        // clears `resumeFrom` (`clearSnapshot`); the layout animation it
        // started from `prev` keeps it as `resumingFrom`.
        expect((next.resumeFrom ?? next.resumingFrom) === prev).toBe(true)

        await frames(1)
        expect(element('a').style.visibility).not.toBe('hidden')
        expect(element('b').style.visibility).not.toBe('hidden')
        expect(element(from).style.opacity).not.toBe('0')
    })
})

/**
 * A gallery: thumbnails `one` and `two` each have their own layoutId, and a
 * persistent, open detail card has `layoutId={open}`. When `open` changes from
 * `one` to `two`, the card leaves stack `one` (so thumbnail one leads it again,
 * resuming from the card) and takes over stack `two` from thumbnail two. The
 * card switches instantly, as it's already open, and thumbnail two follows it
 * out of sight. Thumbnail one animates home from the card's box.
 *
 * JSDOM has no layout, so `getBoundingClientRect` reads each element's box
 * from its `data-box` attribute, as upstream does.
 */
describe("changing an open card's layoutId (#1411)", () => {
    const boxes: Record<string, [number, number, number, number]> = {
        one: [0, 0, 100, 50],
        two: [200, 0, 100, 50],
        card: [50, 200, 400, 300]
    }

    beforeEach(() => {
        vi.useRealTimers()
        stubResizeObserver()
        resetRegistry('one', 'two', 'x')
        mockBoxes(boxes)
    })
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    type Snapshot = { measuredBox: unknown }

    async function openThenChange() {
        const { rerender } = render(LayoutIdGalleryHarness, { props: {} })
        await frames(2)
        await rerender({ open: 'one' })
        await frames(2)

        const one = getNode(element('one'))
        const card = getNode(element('card'))
        // The card grows out of thumbnail one. Finish that.
        expect(card.currentAnimation).toBeDefined()
        card.currentAnimation!.complete()
        await frames(1)

        const snapshots: Record<string, Snapshot> = {}
        for (const id of ['one', 'card']) {
            getNode(element(id)).addEventListener(
                'didUpdate',
                ({ snapshot }: { snapshot: Snapshot }) => (snapshots[id] = snapshot)
            )
        }

        await rerender({ open: 'two' })
        await frames(2)

        return { one, two: getNode(element('two')), card, snapshots }
    }

    it("the old thumbnail resumes from the card's box", async () => {
        const { one, snapshots } = await openThenChange()

        expect(one.isLead()).toBe(true)
        expect(snapshots.one?.measuredBox).toEqual({
            x: { min: 50, max: 450 },
            y: { min: 200, max: 500 }
        })
    })

    it('the card switches instantly and the new thumbnail is hidden', async () => {
        const { two, card, snapshots } = await openThenChange()

        expect(card.getStack()!.lead === card).toBe(true)
        expect(two.getStack() === card.getStack()).toBe(true)
        expect(snapshots.card?.measuredBox).toEqual({
            x: { min: 50, max: 450 },
            y: { min: 200, max: 500 }
        })
        expect(card.currentAnimation).toBeUndefined()
        expect(element('card').style.visibility).not.toBe('hidden')
        expect(element('card').style.opacity).not.toBe('0')
        expect(element('two').style.visibility).toBe('hidden')
    })

    // Amendment A1.3: the card that mounts with thumbnail one's layoutId (a
    // lead still on screen) animates out of it exactly once. A registry
    // handoff for the same id, left by some other element in its handoff
    // window, must not start a second animation from the mount-path consume.
    it('opening the card from a live thumbnail runs one layout animation', async () => {
        const updates: number[] = []
        const onCardProjectionUpdate = () => updates.push(1)
        const { rerender } = render(LayoutIdGalleryHarness, {
            props: { onCardProjectionUpdate }
        })
        await frames(2)
        const one = getNode(element('one'))
        const startAnimation = vi.spyOn(Object.getPrototypeOf(one), 'startAnimation')
        const notify = vi.spyOn(Object.getPrototypeOf(one), 'notifyListeners')
        layoutIdRegistry.snapshot('one', new DOMRect(600, 600, 10, 10), {}, {})

        await rerender({ open: 'one', onCardProjectionUpdate })
        await frames(4)

        const card = getNode(element('card'))
        const ofCard = (spy: typeof startAnimation) =>
            spy.mock.calls.filter((_, index) => spy.mock.contexts[index] === card)
        // One layout animation, out of thumbnail one, from one update pass.
        expect(ofCard(startAnimation).length).toBe(1)
        expect(card.resumingFrom === one).toBe(true)
        expect(ofCard(notify).filter(([event]) => event === 'didUpdate').length).toBe(1)
        // A layoutId-only card reports no reactive layout commit, so any
        // `onProjectionUpdate` would be a second, registry-driven commit.
        expect(updates).toEqual([])
        // ...and nothing is left behind to animate a later change.
        expect(card.snapshot).toBeUndefined()
        expect(layoutIdRegistry.has('one')).toBe(false)
    })

    // A thumbnail that follows an open card and then loses its layoutId must
    // show again, as it no longer follows anything. Upstream's
    // `layoutCrossfade={false}` variant isn't ported (not a svelte-motion prop).
    it('shows a follower again once it loses its layoutId (crossfade undefined)', async () => {
        const { rerender } = render(LayoutIdGalleryHarness, { props: { thumbLayoutId: 'x' } })
        await frames(2)
        await rerender({ thumbLayoutId: 'x', open: 'x' })
        await frames(2)
        getNode(element('card')).currentAnimation?.complete()
        await frames(1)

        await rerender({ thumbLayoutId: null, open: 'x' })
        await frames(1)
        await rerender({ thumbLayoutId: null, open: undefined })
        await frames(1)

        const { style } = element('one')
        expect(style.visibility).not.toBe('hidden')
        expect(style.opacity).not.toBe('0')
        expect(style.pointerEvents).not.toBe('none')
    })
})
