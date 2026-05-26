import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectionNode, type Box } from './projection.js'

/**
 * jsdom doesn't run real layout, so `getBoundingClientRect` is mocked
 * per-element with a controlled `DOMRect`. The projection node's
 * `measure()` zeros the element's own transform (via `measureRect`)
 * and the ancestor chain's inline transforms — the tests verify both
 * the returned box and the restore-after invariants. A side effect of
 * `measureRect` is that it temporarily writes `el.style.transform =
 * 'none'` then restores; the mock doesn't care about that write, so
 * the asserted DOMRect is what comes back.
 */
const mockRect = (el: HTMLElement, rect: DOMRect): ReturnType<typeof vi.spyOn> =>
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect)

const box = (xMin: number, xMax: number, yMin: number, yMax: number): Box => ({
    x: { min: xMin, max: xMax },
    y: { min: yMin, max: yMax }
})

describe('utils/projection - ProjectionNode', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        vi.useRealTimers()
        cleanups = []
    })

    afterEach(() => {
        for (const fn of cleanups) fn()
        vi.restoreAllMocks()
    })

    const makeEl = (): HTMLElement => {
        const el = document.createElement('div')
        document.body.appendChild(el)
        cleanups.push(() => el.remove())
        return el
    }

    describe('lifecycle', () => {
        it('mount sets element + isMounted; unmount clears them', () => {
            const node = new ProjectionNode()
            const el = makeEl()
            expect(node.isMounted).toBe(false)
            expect(node.element).toBeNull()

            node.mount(el)
            expect(node.isMounted).toBe(true)
            expect(node.element).toBe(el)

            node.unmount()
            expect(node.isMounted).toBe(false)
            expect(node.element).toBeNull()
        })

        it('mount with parent registers self in parent.children', () => {
            const parent = new ProjectionNode()
            const child = new ProjectionNode({ parent })
            const parentEl = makeEl()
            const childEl = makeEl()
            parent.mount(parentEl)
            child.mount(childEl)

            expect(parent.children.has(child)).toBe(true)
            expect(child.parent).toBe(parent)
        })

        it('unmount detaches from parent.children and clears descendants', () => {
            const parent = new ProjectionNode()
            const child = new ProjectionNode({ parent })
            parent.mount(makeEl())
            child.mount(makeEl())

            child.unmount()
            expect(parent.children.has(child)).toBe(false)
            expect(child.parent).toBe(parent) // parent ref preserved; only the registration is dropped
            expect(child.children.size).toBe(0)
        })

        it('mount is idempotent for the same element', () => {
            const node = new ProjectionNode()
            const el = makeEl()
            node.mount(el)
            const parentChildrenSize = node.children.size
            node.mount(el)
            // Should not reset state — still mounted on same element.
            expect(node.isMounted).toBe(true)
            expect(node.element).toBe(el)
            expect(node.children.size).toBe(parentChildrenSize)
        })

        it('unmount is safe to call on a never-mounted node', () => {
            const node = new ProjectionNode()
            expect(() => node.unmount()).not.toThrow()
            expect(node.isMounted).toBe(false)
        })
    })

    describe('measure', () => {
        it('returns null for an unmounted node', () => {
            const node = new ProjectionNode()
            expect(node.measure()).toBeNull()
        })

        it('returns a Box derived from the element rect', () => {
            const el = makeEl()
            mockRect(el, new DOMRect(10, 20, 100, 50))
            const node = new ProjectionNode()
            node.mount(el)
            const result = node.measure()
            expect(result).toEqual(box(10, 110, 20, 70))
            expect(node.latestLayout).toEqual(result)
        })

        it('preserves user-authored ancestor transforms present at mount (resets to base, not none)', () => {
            // 3-deep DOM tree: outer → middle → inner. The ancestor
            // transforms exist BEFORE mount, so they're user-authored —
            // upstream's removeBoxTransforms leaves these intact.
            const outerEl = makeEl()
            const middleEl = document.createElement('div')
            const innerEl = document.createElement('div')
            outerEl.appendChild(middleEl)
            middleEl.appendChild(innerEl)
            outerEl.style.transform = 'translate(50px, 100px) scale(1.2)'
            middleEl.style.transform = 'translate(20px, 30px)'

            mockRect(innerEl, new DOMRect(0, 0, 200, 80))

            const outer = new ProjectionNode()
            const middle = new ProjectionNode({ parent: outer })
            const inner = new ProjectionNode({ parent: middle })
            outer.mount(outerEl)
            middle.mount(middleEl)
            inner.mount(innerEl)

            // Spy AFTER mount so only the measure-time writes are captured.
            const outerSpy = vi.spyOn(outerEl.style, 'transform', 'set')
            const middleSpy = vi.spyOn(middleEl.style, 'transform', 'set')

            const result = inner.measure()
            expect(result).toEqual(box(0, 200, 0, 80))

            // Measure resets each ancestor to its captured base (the user
            // transform) — never to 'none'. The static transform stays.
            expect(outerSpy).toHaveBeenCalledWith('translate(50px, 100px) scale(1.2)')
            expect(middleSpy).toHaveBeenCalledWith('translate(20px, 30px)')
            expect(outerSpy).not.toHaveBeenCalledWith('none')
            expect(middleSpy).not.toHaveBeenCalledWith('none')

            // Both ended up restored to their original strings.
            expect(outerEl.style.transform).toBe('translate(50px, 100px) scale(1.2)')
            expect(middleEl.style.transform).toBe('translate(20px, 30px)')
        })

        it('strips an ancestor transform written after mount (motion-applied) during measure', () => {
            const outerEl = makeEl()
            const innerEl = document.createElement('div')
            outerEl.appendChild(innerEl)
            // User base present at mount.
            outerEl.style.transform = 'translate(40px, 60px)'

            mockRect(innerEl, new DOMRect(0, 0, 80, 80))

            const outer = new ProjectionNode()
            const inner = new ProjectionNode({ parent: outer })
            outer.mount(outerEl)
            inner.mount(innerEl)

            // Simulate a FLIP/drag transform written AFTER mount.
            const motionTransform = 'translate(40px, 60px) translate(123px, 0px)'
            outerEl.style.transform = motionTransform

            const outerSpy = vi.spyOn(outerEl.style, 'transform', 'set')
            inner.measure()

            // During the read the ancestor is reset to its mount-time base,
            // dropping the post-mount (motion) portion.
            expect(outerSpy).toHaveBeenCalledWith('translate(40px, 60px)')
            // Restored to the motion-applied value afterwards so the
            // ancestor's own animation continues uninterrupted.
            expect(outerEl.style.transform).toBe(motionTransform)
        })

        it('resets self to its mount-time base transform during measure (not none)', () => {
            const el = makeEl()
            el.style.transform = 'rotate(10deg)' // user base on the measured element itself
            mockRect(el, new DOMRect(0, 0, 100, 100))
            const node = new ProjectionNode()
            node.mount(el)

            const spy = vi.spyOn(el.style, 'transform', 'set')
            node.measure()

            expect(spy).toHaveBeenCalledWith('rotate(10deg)')
            expect(spy).not.toHaveBeenCalledWith('none')
            expect(el.style.transform).toBe('rotate(10deg)')
        })

        it('restores ancestor transforms even when measureRect throws', () => {
            const outerEl = makeEl()
            const innerEl = document.createElement('div')
            outerEl.appendChild(innerEl)
            outerEl.style.transform = 'scale(2)'
            const outerPrev = outerEl.style.transform

            vi.spyOn(innerEl, 'getBoundingClientRect').mockImplementation(() => {
                throw new Error('synthetic measurement failure')
            })

            const outer = new ProjectionNode()
            const inner = new ProjectionNode({ parent: outer })
            outer.mount(outerEl)
            inner.mount(innerEl)

            expect(() => inner.measure()).toThrow('synthetic measurement failure')
            // Critical guarantee: ancestor transform is restored despite the throw.
            expect(outerEl.style.transform).toBe(outerPrev)
        })

        it('measure can be called repeatedly without destructive side effects', () => {
            const el = makeEl()
            const spy = mockRect(el, new DOMRect(5, 5, 100, 100))
            const node = new ProjectionNode()
            node.mount(el)

            const first = node.measure()
            const second = node.measure()
            expect(first).toEqual(second)
            expect(spy).toHaveBeenCalledTimes(2)
        })
    })

    describe('willUpdate / didUpdate', () => {
        it('willUpdate snapshots the current layout box', () => {
            const el = makeEl()
            mockRect(el, new DOMRect(0, 0, 50, 50))
            const node = new ProjectionNode()
            node.mount(el)

            node.willUpdate()
            expect(node.snapshot).toEqual(box(0, 50, 0, 50))
        })

        it('willUpdate is idempotent within a frame — second call does not overwrite first snapshot', () => {
            const el = makeEl()
            const spy = mockRect(el, new DOMRect(0, 0, 50, 50))
            const node = new ProjectionNode()
            node.mount(el)

            node.willUpdate()
            // Change the mock to return a different rect — if willUpdate
            // were not idempotent, the snapshot would silently move.
            spy.mockReturnValue(new DOMRect(200, 200, 50, 50))
            node.willUpdate()
            expect(node.snapshot).toEqual(box(0, 50, 0, 50))
        })

        it('didUpdate after a layout shift fires listeners with hasLayoutChanged: true + correct delta', () => {
            const el = makeEl()
            const spy = mockRect(el, new DOMRect(0, 0, 100, 100))
            const node = new ProjectionNode()
            node.mount(el)

            const listener = vi.fn()
            node.addEventListener('didUpdate', listener)

            node.willUpdate()
            // Simulate post-mutation move 60px right + 40px down.
            spy.mockReturnValue(new DOMRect(60, 40, 100, 100))
            node.didUpdate()

            expect(listener).toHaveBeenCalledTimes(1)
            const payload = listener.mock.calls[0][0]
            expect(payload.hasLayoutChanged).toBe(true)
            expect(payload.delta.x.translate).toBeCloseTo(60, 1)
            expect(payload.delta.y.translate).toBeCloseTo(40, 1)
            expect(payload.layout).toEqual(box(60, 160, 40, 140))
            expect(payload.snapshot).toEqual(box(0, 100, 0, 100))
            expect(node.snapshot).toBeNull()
        })

        it('didUpdate after zero shift fires with hasLayoutChanged: false (sub-pixel regression guard)', () => {
            const el = makeEl()
            mockRect(el, new DOMRect(0, 0, 100, 100))
            const node = new ProjectionNode()
            node.mount(el)

            const listener = vi.fn()
            node.addEventListener('didUpdate', listener)

            node.willUpdate()
            // No mutation between snapshot + didUpdate — delta should be zero.
            node.didUpdate()

            expect(listener).toHaveBeenCalledTimes(1)
            expect(listener.mock.calls[0][0].hasLayoutChanged).toBe(false)
        })

        it('didUpdate is a no-op when willUpdate was never called', () => {
            const el = makeEl()
            mockRect(el, new DOMRect(0, 0, 50, 50))
            const node = new ProjectionNode()
            node.mount(el)

            const listener = vi.fn()
            node.addEventListener('didUpdate', listener)

            node.didUpdate()
            expect(listener).not.toHaveBeenCalled()
            expect(node.snapshot).toBeNull()
        })
    })

    describe('commitLayoutChange (observer-driven path)', () => {
        it('first call after mount seeds latestLayout and fires nothing', () => {
            const el = makeEl()
            mockRect(el, new DOMRect(0, 0, 100, 100))
            const node = new ProjectionNode()
            node.mount(el)
            node.latestLayout = null // simulate a freshly-mounted node with no seed yet

            const listener = vi.fn()
            node.addEventListener('didUpdate', listener)

            node.commitLayoutChange()
            expect(listener).not.toHaveBeenCalled()
            expect(node.latestLayout).toEqual(box(0, 100, 0, 100))
        })

        it('fires didUpdate with the delta against the previous commit when layout changed', () => {
            const el = makeEl()
            const spy = mockRect(el, new DOMRect(0, 0, 100, 100))
            const node = new ProjectionNode()
            node.mount(el)
            node.measure() // seed latestLayout at origin

            const listener = vi.fn()
            node.addEventListener('didUpdate', listener)

            spy.mockReturnValue(new DOMRect(0, 96, 100, 100)) // moved 96px down
            node.commitLayoutChange()

            expect(listener).toHaveBeenCalledTimes(1)
            const payload = listener.mock.calls[0][0]
            expect(payload.hasLayoutChanged).toBe(true)
            expect(payload.delta.y.translate).toBeCloseTo(96, 1)
            expect(payload.snapshot).toEqual(box(0, 100, 0, 100))
            expect(payload.layout).toEqual(box(0, 100, 96, 196))
        })

        it('does NOT fire when the measurement is unchanged (FLIP-transform re-fire guard)', () => {
            // The FLIP animation this commit runs alongside writes its own
            // transform every frame, which re-triggers the same observer.
            // Those re-fires must not fan out a zero-delta event that
            // clobbers the genuine delta from the originating change.
            const el = makeEl()
            mockRect(el, new DOMRect(0, 0, 100, 100))
            const node = new ProjectionNode()
            node.mount(el)
            node.measure() // seed

            const listener = vi.fn()
            node.addEventListener('didUpdate', listener)

            node.commitLayoutChange() // no layout change since the seed
            node.commitLayoutChange() // observer re-fired again, still no change
            expect(listener).not.toHaveBeenCalled()
        })

        it('is a no-op on an unmounted node', () => {
            const node = new ProjectionNode()
            const listener = vi.fn()
            node.addEventListener('didUpdate', listener)
            expect(() => node.commitLayoutChange()).not.toThrow()
            expect(listener).not.toHaveBeenCalled()
        })
    })

    describe('addEventListener', () => {
        it('returns an unsubscribe that prevents future invocations', () => {
            const el = makeEl()
            const spy = mockRect(el, new DOMRect(0, 0, 10, 10))
            const node = new ProjectionNode()
            node.mount(el)

            const listener = vi.fn()
            const off = node.addEventListener('didUpdate', listener)

            node.willUpdate()
            spy.mockReturnValue(new DOMRect(20, 20, 10, 10))
            node.didUpdate()
            expect(listener).toHaveBeenCalledTimes(1)

            off()
            node.willUpdate()
            spy.mockReturnValue(new DOMRect(40, 40, 10, 10))
            node.didUpdate()
            expect(listener).toHaveBeenCalledTimes(1)
        })

        it('unsubscribing mid-iteration is safe — pending listeners still fire', () => {
            const el = makeEl()
            const spy = mockRect(el, new DOMRect(0, 0, 10, 10))
            const node = new ProjectionNode()
            node.mount(el)

            let offSecond: (() => void) | null = null
            const first = vi.fn(() => offSecond?.())
            const second = vi.fn()
            node.addEventListener('didUpdate', first)
            offSecond = node.addEventListener('didUpdate', second)

            node.willUpdate()
            spy.mockReturnValue(new DOMRect(20, 20, 10, 10))
            node.didUpdate()

            // Both listeners fire from this didUpdate even though the
            // first one unsubscribes the second mid-iteration — the
            // implementation snapshots the bucket before iterating.
            expect(first).toHaveBeenCalledTimes(1)
            expect(second).toHaveBeenCalledTimes(1)

            // Second should NOT fire on the next didUpdate.
            node.willUpdate()
            spy.mockReturnValue(new DOMRect(40, 40, 10, 10))
            node.didUpdate()
            expect(second).toHaveBeenCalledTimes(1)
        })

        it('measure fires the measure event', () => {
            const el = makeEl()
            mockRect(el, new DOMRect(0, 0, 50, 50))
            const node = new ProjectionNode()
            node.mount(el)

            const onMeasure = vi.fn()
            node.addEventListener('measure', onMeasure)

            node.measure()
            expect(onMeasure).toHaveBeenCalledTimes(1)
            expect(onMeasure.mock.calls[0][0]).toEqual(box(0, 50, 0, 50))
        })

        it('unmount clears all listeners (no leak)', () => {
            const el = makeEl()
            mockRect(el, new DOMRect(0, 0, 10, 10))
            const node = new ProjectionNode()
            node.mount(el)

            const listener = vi.fn()
            node.addEventListener('didUpdate', listener)

            node.unmount()
            // Re-mount and try to trigger didUpdate — old listener should not fire.
            const el2 = makeEl()
            mockRect(el2, new DOMRect(0, 0, 10, 10))
            node.mount(el2)
            node.willUpdate()
            vi.spyOn(el2, 'getBoundingClientRect').mockReturnValue(new DOMRect(50, 50, 10, 10))
            node.didUpdate()
            expect(listener).not.toHaveBeenCalled()
        })
    })

    describe('getScrollContainers option', () => {
        it('passes scroll-container chain to measureRect via getScrollContainers thunk', () => {
            const el = makeEl()
            const scroller = makeEl()
            scroller.scrollTop = 25
            scroller.scrollLeft = 15
            mockRect(el, new DOMRect(0, 0, 100, 100))

            const node = new ProjectionNode({ getScrollContainers: () => [scroller] })
            node.mount(el)
            const result = node.measure()
            // measureRect adds scrollLeft / scrollTop of every container.
            expect(result).toEqual(box(15, 115, 25, 125))
        })
    })
})
