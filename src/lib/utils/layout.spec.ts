import { describe, expect, it, vi } from 'vitest'
import {
    computeFlipTransforms,
    measureRect,
    observeLayoutChanges,
    runFlipAnimation,
    setCompositorHints
} from './layout.js'

vi.mock('motion', () => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { animate: animateMock }
})
const { animate: animateMock } = (await import('motion')) as unknown as {
    animate: ReturnType<typeof vi.fn> & { mockClear: () => void; mock: { calls: unknown[][] } }
}

describe('utils/layout', () => {
    it('measureRect: returns a DOMRect and restores transform', () => {
        const el = document.createElement('div')
        el.style.transform = 'scale(2)'
        const prev = el.style.transform
        const setSpy = vi.spyOn(el.style, 'transform', 'set')
        const rect = measureRect(el)
        expect(rect).toBeTruthy()
        expect(setSpy).toHaveBeenNthCalledWith(1, 'none')
        expect(setSpy).toHaveBeenNthCalledWith(2, prev)
        expect(el.style.transform).toBe(prev)
    })

    it('measureRect: ignores scrollContainers when none is passed', () => {
        const el = document.createElement('div')
        const spy = vi
            .spyOn(el, 'getBoundingClientRect')
            .mockReturnValue(new DOMRect(10, 20, 100, 50))
        const rect = measureRect(el)
        expect(rect.left).toBe(10)
        expect(rect.top).toBe(20)
        expect(rect.width).toBe(100)
        expect(rect.height).toBe(50)
        spy.mockRestore()
    })

    it('measureRect: ignores scrollContainers when an empty array is passed', () => {
        const el = document.createElement('div')
        const spy = vi
            .spyOn(el, 'getBoundingClientRect')
            .mockReturnValue(new DOMRect(10, 20, 100, 50))
        const rect = measureRect(el, [])
        expect(rect.left).toBe(10)
        expect(rect.top).toBe(20)
        spy.mockRestore()
    })

    it('measureRect: adds viewport scroll when requested', () => {
        const el = document.createElement('div')
        const scrollX = vi.spyOn(window, 'scrollX', 'get').mockReturnValue(15)
        const scrollY = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(40)
        const spy = vi
            .spyOn(el, 'getBoundingClientRect')
            .mockReturnValue(new DOMRect(10, 20, 100, 50))

        const rect = measureRect(el, [], 'none', true)
        expect(rect.left).toBe(25)
        expect(rect.top).toBe(60)
        expect(rect.width).toBe(100)
        expect(rect.height).toBe(50)

        spy.mockRestore()
        scrollX.mockRestore()
        scrollY.mockRestore()
    })

    it('measureRect: adds a single scroll container offset to the returned rect', () => {
        const el = document.createElement('div')
        const scroller = document.createElement('div')
        scroller.scrollTop = 80
        scroller.scrollLeft = 30
        const spy = vi
            .spyOn(el, 'getBoundingClientRect')
            .mockReturnValue(new DOMRect(10, 20, 100, 50))
        const rect = measureRect(el, [scroller])
        // Rect is re-expressed in the scroll container's coordinate space:
        // viewport-relative + container's scroll offset.
        expect(rect.left).toBe(40)
        expect(rect.top).toBe(100)
        expect(rect.width).toBe(100)
        expect(rect.height).toBe(50)
        spy.mockRestore()
    })

    it('measureRect: sums offsets from a chain of nested scroll containers', () => {
        // Regression for #353 — two nested `layoutScroll` containers must
        // both contribute their scroll offsets so the FLIP delta cancels
        // out movement from either.
        const el = document.createElement('div')
        const outer = document.createElement('div')
        const inner = document.createElement('div')
        outer.scrollTop = 30
        outer.scrollLeft = 0
        inner.scrollTop = 50
        inner.scrollLeft = 25
        const spy = vi
            .spyOn(el, 'getBoundingClientRect')
            .mockReturnValue(new DOMRect(10, 20, 100, 50))
        // Chain ordering matches what _MotionContainer publishes: closest
        // (inner) first, then outer. Order doesn't affect the sum.
        const rect = measureRect(el, [inner, outer])
        expect(rect.left).toBe(10 + 25 + 0) // 35
        expect(rect.top).toBe(20 + 50 + 30) // 100
        expect(rect.width).toBe(100)
        expect(rect.height).toBe(50)
        spy.mockRestore()
    })

    it('measureRect + computeFlipTransforms: zero delta when only scroll changes', () => {
        // Regression for layoutScroll: if the user scrolls the container
        // between two measurements but the element doesn't actually move
        // in the container's coordinate space, the FLIP delta must be zero.
        const el = document.createElement('div')
        const scroller = document.createElement('div')
        const getRect = vi.spyOn(el, 'getBoundingClientRect')

        // Frame 1: scrollTop=0, element's viewport-relative top=100
        scroller.scrollTop = 0
        getRect.mockReturnValueOnce(new DOMRect(0, 100, 200, 80))
        const before = measureRect(el, [scroller])

        // Frame 2: user scrolled down 50px; viewport-relative top is now 50
        // but in container space it's the same (100 + 0 vs 50 + 50).
        scroller.scrollTop = 50
        getRect.mockReturnValueOnce(new DOMRect(0, 50, 200, 80))
        const after = measureRect(el, [scroller])

        const transforms = computeFlipTransforms(before, after, true)
        expect(transforms.dx).toBe(0)
        expect(transforms.dy).toBe(0)
        expect(transforms.shouldTranslate).toBe(false)

        getRect.mockRestore()
    })

    it('measureRect + computeFlipTransforms: zero delta when nested containers both scroll', () => {
        // Regression for #353 — the outer scroll-change also has to cancel
        // out in the FLIP delta, not just the closest container's.
        const el = document.createElement('div')
        const outer = document.createElement('div')
        const inner = document.createElement('div')
        const getRect = vi.spyOn(el, 'getBoundingClientRect')

        // Frame 1: both containers at scrollTop=0; element viewport top=200
        outer.scrollTop = 0
        inner.scrollTop = 0
        getRect.mockReturnValueOnce(new DOMRect(0, 200, 200, 80))
        const before = measureRect(el, [inner, outer])

        // Frame 2: outer scrolled 20, inner scrolled 30. Element viewport
        // top is now 200 - 50 = 150 (both scrolls reduce its viewport
        // position). In combined scroll space, it's unchanged: 150 + 50 = 200.
        outer.scrollTop = 20
        inner.scrollTop = 30
        getRect.mockReturnValueOnce(new DOMRect(0, 150, 200, 80))
        const after = measureRect(el, [inner, outer])

        const transforms = computeFlipTransforms(before, after, true)
        expect(transforms.dy).toBe(0)
        expect(transforms.shouldTranslate).toBe(false)

        getRect.mockRestore()
    })

    it('computeFlipTransforms: flags translate/scale appropriately', () => {
        const prev = { left: 0, top: 0, width: 100, height: 100 } as unknown as DOMRect
        const next = { left: 10, top: 5, width: 200, height: 80 } as unknown as DOMRect
        const all = computeFlipTransforms(prev, next, true)
        expect(all.shouldTranslate).toBe(true)
        expect(all.shouldScale).toBe(true)

        const posOnly = computeFlipTransforms(prev, next, 'position')
        expect(posOnly.shouldTranslate).toBe(true)
        expect(posOnly.shouldScale).toBe(false)
    })

    it('computeFlipTransforms: small deltas below threshold do not translate', () => {
        const prev = { left: 0, top: 0, width: 100, height: 100 } as unknown as DOMRect
        const next = { left: 0.2, top: -0.3, width: 100, height: 100 } as unknown as DOMRect
        const res = computeFlipTransforms(prev, next, true)
        expect(res.shouldTranslate).toBe(false)
        expect(res.shouldScale).toBe(false)
    })

    it('computeFlipTransforms: handles zero dimensions safely', () => {
        const prev = { left: 0, top: 0, width: 100, height: 100 } as unknown as DOMRect

        // Zero width on target
        const nextZeroWidth = { left: 0, top: 0, width: 0, height: 100 } as unknown as DOMRect
        const w = computeFlipTransforms(prev, nextZeroWidth, true)
        expect(w.sx).toBe(1)
        expect(Number.isFinite(w.sx)).toBe(true)
        expect(Number.isNaN(w.sx)).toBe(false)
        expect(w.shouldScale).toBe(false)

        // Zero height on target
        const nextZeroHeight = { left: 0, top: 0, width: 100, height: 0 } as unknown as DOMRect
        const h = computeFlipTransforms(prev, nextZeroHeight, true)
        expect(h.sy).toBe(1)
        expect(Number.isFinite(h.sy)).toBe(true)
        expect(Number.isNaN(h.sy)).toBe(false)
        expect(h.shouldScale).toBe(false)
    })

    it('runFlipAnimation: animates only when needed', () => {
        const el = document.createElement('div')
        animateMock.mockClear()
        runFlipAnimation(
            el,
            { dx: 0, dy: 0, sx: 1, sy: 1, shouldTranslate: false, shouldScale: false },
            {}
        )
        expect(animateMock).not.toHaveBeenCalled()

        runFlipAnimation(
            el,
            { dx: 10, dy: 0, sx: 1, sy: 1, shouldTranslate: true, shouldScale: false },
            {}
        )
        expect(animateMock).toHaveBeenCalled()
    })

    it('runFlipAnimation: animates scale-only path', () => {
        const el = document.createElement('div')
        animateMock.mockClear()
        runFlipAnimation(
            el,
            { dx: 0, dy: 0, sx: 1.2, sy: 1.1, shouldTranslate: false, shouldScale: true },
            {}
        )
        // Inline style should have only scale pre-applied
        expect(el.style.transform).toBe('scale(1.2, 1.1)')
        // Animate called with keyframes containing only scale, not translate
        expect(animateMock).toHaveBeenCalled()
        const call = animateMock.mock.calls[0]
        expect(call?.[0]).toBe(el)
        const keyframes = call?.[1] as Record<string, unknown>
        expect(keyframes).toMatchObject({ scaleX: [1.2, 1], scaleY: [1.1, 1] })
        expect('x' in (keyframes as Record<string, unknown>)).toBe(false)
        expect('y' in (keyframes as Record<string, unknown>)).toBe(false)
    })

    it('runFlipAnimation: animates box size when scaling would distort layout descendants', async () => {
        const el = document.createElement('button')
        const child = document.createElement('span')
        child.setAttribute('data-svelte-motion-layout', '')
        el.appendChild(child)

        let measureCount = 0
        vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => {
            measureCount += 1
            return measureCount === 1 ? new DOMRect(100, 20, 80, 30) : new DOMRect(100, 20, 60, 30)
        })

        animateMock.mockClear()
        runFlipAnimation(
            el,
            { dx: 0, dy: 0, sx: 0.75, sy: 1, shouldTranslate: false, shouldScale: true },
            {}
        )

        expect(el.getAttribute('data-layout-size-animation')).toBe('true')
        expect(el.style.width).toBe('60px')

        const call = animateMock.mock.calls[0]
        expect(call?.[0]).toBe(0)
        expect(call?.[1]).toBe(1)
        const options = call?.[2] as { onUpdate?: (progress: number) => void }
        options.onUpdate?.(0.5)
        expect(el.style.width).toBe('70px')
        expect(el.style.height).toBe('30px')
        expect(child.style.transform).toBe('')

        await Promise.resolve()
        expect(el.hasAttribute('data-layout-size-animation')).toBe(false)
    })

    it('setCompositorHints: toggles styles', () => {
        const el = document.createElement('div')
        setCompositorHints(el, true)
        expect(el.style.willChange).toBe('transform')
        setCompositorHints(el, false)
        expect(el.style.willChange).toBe('')
    })

    it('observeLayoutChanges: calls callback and cleans up (with parent branch)', () => {
        const el = document.createElement('div')
        const parent = document.createElement('div')
        parent.appendChild(el)
        const cb = vi.fn()

        // Minimal shims for ResizeObserver/MutationObserver that record observe(...) calls
        const resizeObserveCalls: Array<{ target: Element; options?: unknown }> = []
        class FakeResizeObserver {
            private _cb: ResizeObserverCallback
            constructor(cb2: ResizeObserverCallback) {
                this._cb = cb2
            }
            observe(target: Element, options?: unknown) {
                resizeObserveCalls.push({ target, options })
                this._cb([], this as unknown as ResizeObserver)
            }
            disconnect() {}
        }
        const mutationObserveCalls: Array<{ target: Node; options: MutationObserverInit }> = []
        class FakeMutationObserver {
            private _cb: MutationCallback
            constructor(cb2: MutationCallback) {
                this._cb = cb2
            }
            observe(target: Node, options: MutationObserverInit) {
                mutationObserveCalls.push({ target, options })
                this._cb([], this as unknown as MutationObserver)
            }
            disconnect() {}
        }
        vi.stubGlobal('ResizeObserver', FakeResizeObserver as unknown as typeof ResizeObserver)
        vi.stubGlobal(
            'MutationObserver',
            FakeMutationObserver as unknown as typeof MutationObserver
        )

        const cleanup = observeLayoutChanges(el, cb)
        expect(cb).toHaveBeenCalled()
        // Verify observers were configured with correct targets/options
        expect(resizeObserveCalls).toEqual(
            expect.arrayContaining([expect.objectContaining({ target: el })])
        )
        expect(mutationObserveCalls).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    target: el,
                    options: expect.objectContaining({
                        attributes: true,
                        attributeFilter: ['class', 'data-presence-layout-hold']
                    })
                }),
                expect.objectContaining({
                    target: el,
                    options: expect.objectContaining({
                        childList: true,
                        subtree: true
                    })
                }),
                expect.objectContaining({
                    target: parent,
                    options: expect.objectContaining({
                        childList: true,
                        subtree: false
                    })
                })
            ])
        )
        cleanup()

        vi.unstubAllGlobals()
    })

    it('observeLayoutChanges: throttles via requestAnimationFrame and cancels on cleanup (no parent)', () => {
        const el = document.createElement('div')
        const cb = vi.fn()

        // Fake rAF/cAF
        let nextId = 1
        const rafCallbacks = new Map<number, FrameRequestCallback>()
        const rafSpy = vi
            .spyOn(
                globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame },
                'requestAnimationFrame'
            )
            .mockImplementation((fn: FrameRequestCallback): number => {
                const id = nextId++
                rafCallbacks.set(id, fn)
                return id
            })
        const cafSpy = vi
            .spyOn(
                globalThis as unknown as { cancelAnimationFrame: typeof cancelAnimationFrame },
                'cancelAnimationFrame'
            )
            .mockImplementation((id: number) => {
                rafCallbacks.delete(id)
            })

        // Shims capturing callbacks without parent observation
        class FakeResizeObserver {
            private _cb: ResizeObserverCallback
            constructor(cb2: ResizeObserverCallback) {
                this._cb = cb2
            }
            observe() {
                this._cb([], this as unknown as ResizeObserver)
            }
            disconnect() {}
        }
        class FakeMutationObserver {
            private _cb: MutationCallback
            constructor(cb2: MutationCallback) {
                this._cb = cb2
            }
            observe() {
                this._cb([], this as unknown as MutationObserver)
            }
            disconnect() {}
        }
        vi.stubGlobal('ResizeObserver', FakeResizeObserver as unknown as typeof ResizeObserver)
        vi.stubGlobal(
            'MutationObserver',
            FakeMutationObserver as unknown as typeof MutationObserver
        )

        const cleanup = observeLayoutChanges(el, cb)

        // Trigger multiple observer callbacks within the same frame
        const ro = new (
            window as unknown as { ResizeObserver: typeof ResizeObserver }
        ).ResizeObserver((() => {}) as unknown as ResizeObserverCallback)
        ro.observe(el)
        const mo = new (
            window as unknown as { MutationObserver: typeof MutationObserver }
        ).MutationObserver((() => {}) as unknown as MutationCallback)
        mo.observe(el, { attributes: true })
        mo.observe(el, { attributes: true })

        // Leading-edge throttling: callback should have fired only once
        expect(cb).toHaveBeenCalledTimes(1)

        // Now cleanup should cancel any pending rAF
        expect(rafCallbacks.size).toBeGreaterThan(0)
        const scheduledId = [...rafCallbacks.keys()][0]
        expect(typeof scheduledId).toBe('number')
        cleanup()
        expect(cafSpy).toHaveBeenCalled()

        // Teardown
        rafSpy.mockRestore()
        cafSpy.mockRestore()
        vi.unstubAllGlobals()
    })

    it('observeLayoutChanges: ignores layout changes while an ancestor is box-size animating', () => {
        const parent = document.createElement('div')
        const el = document.createElement('div')
        parent.setAttribute('data-layout-size-animation', 'true')
        parent.appendChild(el)
        el.style.transform = 'translateX(12px)'
        el.style.transformOrigin = '0 0'
        el.style.willChange = 'transform'
        const cb = vi.fn()

        class FakeResizeObserver {
            private _cb: ResizeObserverCallback
            constructor(cb2: ResizeObserverCallback) {
                this._cb = cb2
            }
            observe() {
                this._cb([], this as unknown as ResizeObserver)
            }
            disconnect() {}
        }
        class FakeMutationObserver {
            private _cb: MutationCallback
            constructor(cb2: MutationCallback) {
                this._cb = cb2
            }
            observe() {
                this._cb([], this as unknown as MutationObserver)
            }
            disconnect() {}
        }
        vi.stubGlobal('ResizeObserver', FakeResizeObserver as unknown as typeof ResizeObserver)
        vi.stubGlobal(
            'MutationObserver',
            FakeMutationObserver as unknown as typeof MutationObserver
        )

        const cleanup = observeLayoutChanges(el, cb)

        expect(cb).not.toHaveBeenCalled()
        expect(el.style.transform).toBe('')
        expect(el.style.transformOrigin).toBe('')
        expect(el.style.willChange).toBe('')

        cleanup()
        vi.unstubAllGlobals()
    })

    it('observeLayoutChanges: falls back to setTimeout when rAF is unavailable and clears on cleanup', () => {
        const el = document.createElement('div')
        const cb = vi.fn()

        // Remove rAF so fallback path executes
        const originalRaf = (window as unknown as { requestAnimationFrame?: unknown })
            .requestAnimationFrame
        ;(window as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame =
            undefined

        // Capture setTimeout id and ensure clearTimeout receives it
        const timeoutId = 98765
        const setTimeoutSpy = vi
            .spyOn(globalThis, 'setTimeout')
            // @ts-expect-error types mismatch acceptable for test stub
            .mockImplementation(() => timeoutId)
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {})

        // Shims to trigger schedule()
        class FakeResizeObserver {
            private _cb: ResizeObserverCallback
            constructor(cb2: ResizeObserverCallback) {
                this._cb = cb2
            }
            observe() {
                this._cb([], this as unknown as ResizeObserver)
            }
            disconnect() {}
        }
        class FakeMutationObserver {
            constructor() {}
            observe() {}
            disconnect() {}
        }
        vi.stubGlobal('ResizeObserver', FakeResizeObserver as unknown as typeof ResizeObserver)
        vi.stubGlobal(
            'MutationObserver',
            FakeMutationObserver as unknown as typeof MutationObserver
        )

        const cleanup = observeLayoutChanges(el, cb)

        // Trigger once; leading-edge calls cb immediately and sets a timeout token
        const ro2 = new (
            window as unknown as { ResizeObserver: typeof ResizeObserver }
        ).ResizeObserver((() => {}) as unknown as ResizeObserverCallback)
        ro2.observe(el)
        expect(cb).toHaveBeenCalledTimes(1)

        // Cleanup should clear the stored timeout id
        cleanup()
        expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId)

        // Restore
        setTimeoutSpy.mockRestore()
        clearTimeoutSpy.mockRestore()
        ;(window as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame =
            originalRaf
        vi.unstubAllGlobals()
    })
})
