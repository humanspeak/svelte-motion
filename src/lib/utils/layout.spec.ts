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
                        attributeFilter: ['class', 'style']
                    })
                })
            ])
        )
        cleanup()

        vi.unstubAllGlobals()
    })
})
