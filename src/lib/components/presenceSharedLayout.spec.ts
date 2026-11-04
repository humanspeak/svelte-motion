import { MotionDomProjectionAdapter } from '$lib/utils/motionDomProjection'
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PresenceSharedLayoutHarness from './__tests__/PresenceSharedLayoutHarness.svelte'

const log: string[] = []

// Record every boundary's `unregisterChild`, calling through.
vi.mock('$lib/utils/presence', async (importOriginal) => {
    const original = await importOriginal<typeof import('$lib/utils/presence')>()
    return {
        ...original,
        createAnimatePresenceContext: (
            ...args: Parameters<typeof original.createAnimatePresenceContext>
        ) => {
            const context = original.createAnimatePresenceContext(...args)
            const unregisterChild = context.unregisterChild
            context.unregisterChild = (key: string) => {
                log.push(`unregister:${key}`)
                unregisterChild(key)
            }
            return context
        }
    }
})

vi.mock('motion', () => ({
    animate: vi.fn(() => ({ finished: Promise.resolve(), stop() {} }))
}))

/**
 * Plan 012 (U11): the Svelte teardown order the clone path's hand-off relies
 * on. The departing element's `unregisterChild` must run while its projection
 * node, and its descendants' nodes, are still mounted, and before the
 * arriving node mounts (`effects.js:464-488` destroys children in creation
 * order; `BranchManager.ensure`, `branches.js:186-240`, creates the new branch
 * first).
 */
describe('presence shared layout teardown order (plan 012)', () => {
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
        // jsdom has no WAAPI; the motion container's layout capture calls it.
        ;(Element.prototype as unknown as { getAnimations: () => Animation[] }).getAnimations =
            () => []
        log.length = 0
        const proto = MotionDomProjectionAdapter.prototype
        const mount = Reflect.get(proto, 'mount')
        const unmount = Reflect.get(proto, 'unmount')
        vi.spyOn(MotionDomProjectionAdapter.prototype, 'mount').mockImplementation(function (
            this: MotionDomProjectionAdapter,
            element: HTMLElement,
            options?: { takeOverLiveLead?: boolean }
        ) {
            log.push(`mount:${element.id}`)
            return mount.call(this, element, options)
        })
        vi.spyOn(MotionDomProjectionAdapter.prototype, 'unmount').mockImplementation(function (
            this: MotionDomProjectionAdapter
        ) {
            const element = (this as unknown as { element: HTMLElement | null }).element
            if (element) log.push(`unmount:${element.id}`)
            return unmount.call(this)
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    for (const split of [false, true]) {
        it(`11a: unregister, then the departing unmount, then the arriving mount (${split ? 'two {#if} blocks' : '{#if}…{:else}'})`, async () => {
            const { rerender } = render(PresenceSharedLayoutHarness, { which: 'a', split })
            await tick()
            log.length = 0
            await rerender({ which: 'b', split })
            await tick()
            const at = (entry: string) => log.indexOf(entry)
            expect(at('unregister:a'), log.join(' ')).toBeGreaterThanOrEqual(0)
            expect(at('unregister:a')).toBeLessThan(at('unmount:a'))
            expect(at('unmount:a')).toBeLessThan(at('mount:b'))
        })
    }

    it('11b: unregisterChild runs before a nested motion child unmounts', async () => {
        const { rerender } = render(PresenceSharedLayoutHarness, { which: 'a', nested: true })
        await tick()
        log.length = 0
        await rerender({ which: null, nested: true })
        await tick()
        expect(log.indexOf('unregister:a'), log.join(' ')).toBeGreaterThanOrEqual(0)
        expect(log.indexOf('unmount:a-inner'), log.join(' ')).toBeGreaterThanOrEqual(0)
        expect(log.indexOf('unregister:a')).toBeLessThan(log.indexOf('unmount:a-inner'))
    })

    it('10d-ii: a child whose layoutId is cleared in the removing flush is still handed off', async () => {
        type Api = { handOffToExitClone?: (...args: unknown[]) => unknown }
        const handOffs: string[] = []
        const proto = MotionDomProjectionAdapter.prototype as unknown as Api
        const original = proto.handOffToExitClone
        proto.handOffToExitClone = function (this: unknown, ...args: unknown[]) {
            handOffs.push('a')
            return original?.apply(this, args)
        }
        try {
            const { rerender } = render(PresenceSharedLayoutHarness, { which: 'a' })
            await tick()
            await rerender({ which: null, clearId: true })
            await tick()
            expect(handOffs).toEqual(['a'])
        } finally {
            proto.handOffToExitClone = original
        }
    })
})

/**
 * Plan 012 Step 2: `onLayoutAnimationStart` / `onLayoutAnimationComplete`
 * reach the VisualElement's props, where the projection node reads them for
 * the layout animation's `onPlay` / `onComplete`
 * (`create-projection-node.ts:586-589, 626-628 @ v14.7.1`).
 */
describe('layout animation callbacks (plan 012 Step 2)', () => {
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
        ;(Element.prototype as unknown as { getAnimations: () => Animation[] }).getAnimations =
            () => []
        // jsdom has no layout: a box is as wide as its inline width.
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            return new DOMRect(10, 10, parseFloat(this.style.width) || 0, 50)
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it("calls both once for a layout element's layout animation", async () => {
        const onLayoutAnimationStart = vi.fn()
        const onLayoutAnimationComplete = vi.fn()
        const { rerender } = render(PresenceSharedLayoutHarness, {
            boxWidth: 100,
            onLayoutAnimationStart,
            onLayoutAnimationComplete
        })
        await tick()
        await new Promise((resolve) => setTimeout(resolve, 50))
        await rerender({ boxWidth: 200, onLayoutAnimationStart, onLayoutAnimationComplete })
        await tick()
        await new Promise((resolve) => setTimeout(resolve, 300))
        expect(onLayoutAnimationStart).toHaveBeenCalledTimes(1)
        expect(onLayoutAnimationComplete).toHaveBeenCalledTimes(1)
    })
})
