import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    computeFlipTransforms,
    measureRect,
    observeLayoutChanges,
    runFlipAnimation,
    selectLayoutDependencies,
    setCompositorHints,
    stripNonChildLayoutStyle
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
        expect('x' in keyframes).toBe(false)
        expect('y' in keyframes).toBe(false)
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
        vi.stubGlobal('ResizeObserver', FakeResizeObserver)
        vi.stubGlobal('MutationObserver', FakeMutationObserver)

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
                        subtree: true
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
        vi.stubGlobal('ResizeObserver', FakeResizeObserver)
        vi.stubGlobal('MutationObserver', FakeMutationObserver)

        const cleanup = observeLayoutChanges(el, cb)

        // Trigger multiple observer callbacks within the same frame
        const ro = new (
            window as unknown as { ResizeObserver: typeof ResizeObserver }
        ).ResizeObserver(() => {})
        ro.observe(el)
        const mo = new (
            window as unknown as { MutationObserver: typeof MutationObserver }
        ).MutationObserver(() => {})
        mo.observe(el, { attributes: true })
        mo.observe(el, { attributes: true })

        // Leading-edge throttling: callback should have fired only once
        expect(cb).toHaveBeenCalledTimes(1)

        // The scheduled frame fires a trailing check for post-mutation layout.
        expect(rafCallbacks.size).toBeGreaterThan(0)
        const scheduledId = [...rafCallbacks.keys()][0]
        expect(typeof scheduledId).toBe('number')
        rafCallbacks.get(scheduledId)?.(performance.now())
        expect(cb).toHaveBeenCalledTimes(2)

        cleanup()

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
        vi.stubGlobal('ResizeObserver', FakeResizeObserver)
        vi.stubGlobal('MutationObserver', FakeMutationObserver)

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
            .spyOn(window, 'setTimeout')
            // @ts-expect-error types mismatch acceptable for test stub
            .mockImplementation(() => timeoutId)
        const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout').mockImplementation(() => {})

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
        vi.stubGlobal('ResizeObserver', FakeResizeObserver)
        vi.stubGlobal('MutationObserver', FakeMutationObserver)

        const cleanup = observeLayoutChanges(el, cb)

        // Trigger once; leading-edge calls cb immediately and sets a timeout token
        const ro2 = new (
            window as unknown as { ResizeObserver: typeof ResizeObserver }
        ).ResizeObserver(() => {})
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

    describe('observeLayoutChanges: bounded ancestor observation + re-parent re-bind', () => {
        // These cases exercise the REAL jsdom MutationObserver (async microtask
        // delivery) rather than the synchronous doubles above, because they
        // depend on real mutation records (attributeName / oldValue) and on the
        // ancestor-chain wiring. jsdom has no ResizeObserver, so a no-op stub is
        // installed; rAF is patched to a real timer so schedule()'s throttle
        // releases between mutations deterministically.
        class NoopResizeObserver {
            observe() {}
            disconnect() {}
        }
        const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 60))
        let restoreRaf: (() => void) | undefined

        beforeEach(() => {
            // The shared setup installs fake timers, which freeze setTimeout and
            // the frame loop; these cases need a real clock so jsdom's async
            // MutationObserver delivery and the flush timeout actually run.
            vi.useRealTimers()
            vi.stubGlobal('ResizeObserver', NoopResizeObserver)
            const win = window as unknown as {
                requestAnimationFrame: typeof requestAnimationFrame
                cancelAnimationFrame: typeof cancelAnimationFrame
            }
            const prevRaf = win.requestAnimationFrame
            const prevCaf = win.cancelAnimationFrame
            win.requestAnimationFrame = ((fn: FrameRequestCallback) =>
                setTimeout(
                    () => fn(performance.now()),
                    0
                )) as unknown as typeof requestAnimationFrame
            win.cancelAnimationFrame = (id: number) => clearTimeout(id)
            restoreRaf = () => {
                win.requestAnimationFrame = prevRaf
                win.cancelAnimationFrame = prevCaf
            }
        })

        afterEach(() => {
            restoreRaf?.()
            vi.unstubAllGlobals()
            document.body.innerHTML = ''
        })

        it('re-slots on a grandparent layout-affecting style change', async () => {
            const grandparent = document.createElement('div')
            const wrapper = document.createElement('div')
            const el = document.createElement('div')
            grandparent.appendChild(wrapper)
            wrapper.appendChild(el)
            document.body.appendChild(grandparent)

            const cb = vi.fn()
            const cleanup = observeLayoutChanges(el, cb)
            await flush()
            cb.mockClear()

            // The middle wrapper's attributes never change; the ONLY signal is
            // the grandparent's align-items flip two levels up.
            grandparent.style.alignItems = 'flex-end'
            await flush()

            expect(cb, 'a grandparent re-slot must be observed').toHaveBeenCalled()
            cleanup()
        })

        it('ignores a grandparent style change that only touches an animation channel', async () => {
            const grandparent = document.createElement('div')
            const wrapper = document.createElement('div')
            const el = document.createElement('div')
            grandparent.appendChild(wrapper)
            wrapper.appendChild(el)
            document.body.appendChild(grandparent)

            const cb = vi.fn()
            const cleanup = observeLayoutChanges(el, cb)
            await flush()
            cb.mockClear()

            // transform is written every frame by gesture/FLIP writers and never
            // re-slots children — the same filter that protects the immediate
            // parent must apply at ancestor levels or commit storms follow.
            grandparent.style.transform = 'scale(2)'
            await flush()

            expect(
                cb,
                'an animation-channel-only ancestor change must be filtered'
            ).not.toHaveBeenCalled()
            cleanup()
        })

        it('does not observe beyond MAX_OBSERVED_ANCESTORS (4) levels', async () => {
            // Chain above el: a1 (1st) … a5 (5th). Only 4 levels are watched.
            const a5 = document.createElement('div')
            const a4 = document.createElement('div')
            const a3 = document.createElement('div')
            const a2 = document.createElement('div')
            const a1 = document.createElement('div')
            const el = document.createElement('div')
            a5.appendChild(a4)
            a4.appendChild(a3)
            a3.appendChild(a2)
            a2.appendChild(a1)
            a1.appendChild(el)
            document.body.appendChild(a5)

            const cb = vi.fn()
            const cleanup = observeLayoutChanges(el, cb)
            await flush()
            cb.mockClear()

            // The 4th ancestor is within the bound — it fires.
            a4.style.alignItems = 'flex-end'
            await flush()
            expect(cb, 'the 4th ancestor is within the bound').toHaveBeenCalled()
            cb.mockClear()

            // The 5th ancestor is beyond the bound — it must be silent.
            a5.style.alignItems = 'flex-end'
            await flush()
            expect(cb, 'the 5th ancestor is beyond the bound').not.toHaveBeenCalled()
            cleanup()
        })

        it('re-binds ancestor observers after the element is re-parented', async () => {
            const oldParent = document.createElement('div')
            const newParent = document.createElement('div')
            const el = document.createElement('div')
            oldParent.appendChild(el)
            document.body.appendChild(oldParent)
            document.body.appendChild(newParent)

            const cb = vi.fn()
            const cleanup = observeLayoutChanges(el, cb)
            await flush()
            cb.mockClear()

            // Imperative move: removal from oldParent is observed → schedule →
            // rewireIfReparented picks up the new chain.
            newParent.appendChild(el)
            await flush()
            cb.mockClear()

            // The NEW parent's layout style must now drive changes.
            newParent.style.alignItems = 'flex-end'
            await flush()
            expect(cb, 'the new parent must be observed after a re-parent').toHaveBeenCalled()
            cb.mockClear()

            // The OLD parent must no longer drive changes.
            oldParent.style.alignItems = 'flex-end'
            await flush()
            expect(cb, 'the old parent must be silent after a re-parent').not.toHaveBeenCalled()
            cleanup()
        })

        it('cleanup disconnects every observed ancestor level (no leak)', async () => {
            const a4 = document.createElement('div')
            const a3 = document.createElement('div')
            const a2 = document.createElement('div')
            const a1 = document.createElement('div')
            const el = document.createElement('div')
            a4.appendChild(a3)
            a3.appendChild(a2)
            a2.appendChild(a1)
            a1.appendChild(el)
            document.body.appendChild(a4)

            const cb = vi.fn()
            const cleanup = observeLayoutChanges(el, cb)
            await flush()
            cleanup()
            cb.mockClear()

            for (const ancestor of [a1, a2, a3, a4]) {
                ancestor.style.alignItems = 'flex-end'
            }
            await flush()

            expect(cb, 'no ancestor may fire after cleanup').not.toHaveBeenCalled()
        })
    })

    describe('selectLayoutDependencies (#314 layoutDependency)', () => {
        it('gates on only the dependency when one is provided', () => {
            expect(selectLayoutDependencies('order-key', () => ['class', 'style'])).toEqual([
                'order-key'
            ])
        })

        it('does NOT evaluate the fallback when gated (laziness is the optimization)', () => {
            const fallback = vi.fn(() => ['class', 'style'])
            const deps = selectLayoutDependencies(42, fallback)

            expect(deps).toEqual([42])
            // The whole point: fallback props are never read while gating is on,
            // so they cannot register as reactive dependencies and force a
            // re-measure.
            expect(fallback).not.toHaveBeenCalled()
        })

        it('uses the (lazily evaluated) fallback deps when dependency is undefined', () => {
            const fallback = vi.fn(() => ['class', 'style', 'layoutId'])
            const deps = selectLayoutDependencies(undefined, fallback)

            expect(deps).toEqual(['class', 'style', 'layoutId'])
            expect(fallback).toHaveBeenCalledTimes(1)
        })

        it('treats falsy-but-defined values (0, "", null, false) as gating', () => {
            const fallback = vi.fn(() => ['class'])

            expect(selectLayoutDependencies(0, fallback)).toEqual([0])
            expect(selectLayoutDependencies('', fallback)).toEqual([''])
            expect(selectLayoutDependencies(null, fallback)).toEqual([null])
            expect(selectLayoutDependencies(false, fallback)).toEqual([false])
            expect(fallback).not.toHaveBeenCalled()
        })

        it('treats objects and arrays as gating dependencies', () => {
            const fallback = vi.fn(() => ['class'])
            const obj = { foo: 'bar' }
            const arr = [1, 2, 3]

            expect(selectLayoutDependencies(obj, fallback)).toEqual([obj])
            expect(selectLayoutDependencies(arr, fallback)).toEqual([arr])
            expect(fallback).not.toHaveBeenCalled()
        })
    })
})

describe('stripNonChildLayoutStyle', () => {
    it('drops animation channels and keeps layout declarations', () => {
        expect(
            stripNonChildLayoutStyle(
                'align-items: flex-end; transform: scale(2); will-change: transform; opacity: 0.5'
            )
        ).toBe('align-items:flex-end')
    })

    it('drops every filtered channel individually', () => {
        for (const declaration of [
            'transform: translateY(4px)',
            'transform-origin: 0 0',
            'translate: 10px 20px',
            'rotate: 45deg',
            'scale: 1.2',
            'will-change: transform',
            'opacity: 0.4',
            'filter: blur(2px)'
        ]) {
            expect(stripNonChildLayoutStyle(declaration), declaration).toBe('')
        }
    })

    it('keeps common layout declarations', () => {
        expect(
            stripNonChildLayoutStyle(
                'display: flex; align-items: center; justify-content: space-between; width: 80px; padding: 10px'
            )
        ).toBe(
            'display:flex;align-items:center;justify-content:space-between;width:80px;padding:10px'
        )
    })

    it('normalizes whitespace and casing for stable comparison', () => {
        expect(stripNonChildLayoutStyle('Align-Items:flex-start')).toBe(
            stripNonChildLayoutStyle('align-items:  flex-start ')
        )
        expect(stripNonChildLayoutStyle('TRANSFORM: scale(2)')).toBe('')
    })

    it('treats transform-only strings as empty', () => {
        expect(stripNonChildLayoutStyle('transform: translate(1px, 2px); rotate: 45deg')).toBe('')
        expect(stripNonChildLayoutStyle('')).toBe('')
    })

    it('splits on the FIRST colon so colon-bearing values survive', () => {
        expect(stripNonChildLayoutStyle('background-image: url(data:image/png;base64,x)')).toBe(
            // The `;` inside url() splits the declaration — both sides of a
            // before/after comparison break identically, so change detection
            // stays stable even though the value is mangled.
            'background-image:url(data:image/png'
        )
        expect(stripNonChildLayoutStyle('grid-area: 1 / 2 / 3 / 4')).toBe('grid-area:1 / 2 / 3 / 4')
    })

    it('keeps custom properties (they can drive child layout via var())', () => {
        expect(stripNonChildLayoutStyle('--gap: 4px; transform: none')).toBe('--gap:4px')
    })

    it('drops filtered channels regardless of !important', () => {
        expect(stripNonChildLayoutStyle('transform: scale(2) !important')).toBe('')
    })

    it('ignores malformed declarations without a colon', () => {
        expect(stripNonChildLayoutStyle('garbage; align-items: center;;')).toBe(
            'align-items:center'
        )
    })

    it('preserves declaration order (a reorder counts as a change)', () => {
        expect(stripNonChildLayoutStyle('width: 1px; height: 2px')).not.toBe(
            stripNonChildLayoutStyle('height: 2px; width: 1px')
        )
    })
})
