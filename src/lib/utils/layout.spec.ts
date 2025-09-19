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
        const rect = measureRect(el)
        expect(rect).toBeTruthy()
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

    it('observeLayoutChanges: calls callback and cleans up', () => {
        const el = document.createElement('div')
        const cb = vi.fn()

        // Minimal shims for ResizeObserver/MutationObserver
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
        expect(cb).toHaveBeenCalled()
        cleanup()

        vi.unstubAllGlobals()
    })
})
