import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { moveRootMargin, observeMove, type MoveRect } from './observeMove.js'

/** Scriptable IntersectionObserver: tests deliver entries by hand. */
class FakeObserver {
    static instances: FakeObserver[] = []
    readonly rootMargin: string
    readonly threshold: number
    readonly root: unknown
    disconnected = false
    observed: Element[] = []

    constructor(
        readonly callback: IntersectionObserverCallback,
        init: IntersectionObserverInit = {}
    ) {
        this.rootMargin = init.rootMargin ?? '0px'
        this.threshold = typeof init.threshold === 'number' ? init.threshold : 0
        this.root = init.root
        FakeObserver.instances.push(this)
    }
    observe(element: Element) {
        this.observed.push(element)
    }
    disconnect() {
        this.disconnected = true
    }
    /** Deliver one entry for `rect` at `ratio`. */
    fire(rect: MoveRect, ratio: number) {
        const boundingClientRect = new DOMRect(rect.left, rect.top, rect.width, rect.height)
        this.callback(
            [{ boundingClientRect, intersectionRatio: ratio } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
        )
    }
}

const live = () => FakeObserver.instances.filter((io) => !io.disconnected)
const current = () => {
    const observers = live()
    expect(observers).toHaveLength(1)
    return observers[0]
}

describe('moveRootMargin', () => {
    it('insets the viewport to exactly the element rect', () => {
        expect(moveRootMargin({ left: 10, top: 20, width: 100, height: 50 }, 800, 600)).toBe(
            '-20px -690px -530px -10px'
        )
    })

    it('floors sub-pixel edges so the root never ends up smaller than the element', () => {
        // right inset 800 − 110.6 = 689.4 → 689; bottom 600 − 70.7 = 529.3 → 529
        expect(moveRootMargin({ left: 10.4, top: 20.7, width: 100.2, height: 50 }, 800, 600)).toBe(
            '-20px -689px -529px -10px'
        )
    })

    it('grows the root out to an element outside the viewport', () => {
        expect(moveRootMargin({ left: -50, top: 900, width: 100, height: 50 }, 800, 600)).toBe(
            '-900px -750px 350px 50px'
        )
    })
})

describe('observeMove', () => {
    const rect = { left: 10, top: 20, width: 100, height: 50 }
    let element: HTMLElement

    beforeEach(() => {
        vi.useFakeTimers()
        FakeObserver.instances = []
        vi.stubGlobal('IntersectionObserver', FakeObserver)
        element = document.createElement('div')
        document.body.appendChild(element)
        Object.defineProperty(document.documentElement, 'clientWidth', {
            value: 800,
            configurable: true
        })
        Object.defineProperty(document.documentElement, 'clientHeight', {
            value: 600,
            configurable: true
        })
    })
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
        element.remove()
    })

    it('is a no-op without IntersectionObserver', () => {
        vi.stubGlobal('IntersectionObserver', undefined)
        const stop = observeMove(element, vi.fn())
        expect(FakeObserver.instances).toHaveLength(0)
        expect(() => stop()).not.toThrow()
    })

    it('arms from the first plain entry without calling getBoundingClientRect', () => {
        const reads = vi.spyOn(element, 'getBoundingClientRect')
        const onMove = vi.fn()
        observeMove(element, onMove)
        const plain = current()
        expect(plain.rootMargin).toBe('0px')
        expect(plain.observed).toEqual([element])

        plain.fire(rect, 1)
        const armed = current()
        expect(armed.rootMargin).toBe('-20px -690px -530px -10px')
        expect(armed.threshold).toBe(1)
        expect(armed.root).toBe(document)

        // Its own first check: still in place, fully inside the root.
        armed.fire(rect, 1)
        expect(current()).toBe(armed)
        expect(onMove).not.toHaveBeenCalled()
        expect(reads).not.toHaveBeenCalled()
    })

    it('reports a move and re-arms around the new rect', () => {
        const onMove = vi.fn()
        observeMove(element, onMove)
        current().fire(rect, 1)
        const armed = current()
        armed.fire(rect, 1)

        const moved = { ...rect, top: 140 }
        armed.fire(moved, 0.2)
        expect(onMove).toHaveBeenCalledTimes(1)
        expect(onMove.mock.calls[0][0]).toMatchObject(moved)
        expect(armed.disconnected).toBe(true)
        const rearmed = current()
        expect(rearmed.rootMargin).toBe('-140px -690px -410px -10px')
        expect(rearmed.threshold).toBe(1)
    })

    it('treats a rect that changed before the first check as a move', () => {
        const onMove = vi.fn()
        observeMove(element, onMove)
        current().fire(rect, 1)
        current().fire({ ...rect, left: 30 }, 0.8)
        expect(onMove).toHaveBeenCalledTimes(1)
        expect(current().rootMargin).toBe('-20px -670px -530px -30px')
    })

    it('re-arms at the clipped ratio for an element clipped in place', () => {
        const onMove = vi.fn()
        observeMove(element, onMove)
        current().fire(rect, 1)
        current().fire(rect, 0.5)
        expect(onMove).not.toHaveBeenCalled()
        expect(current().threshold).toBe(0.5)
    })

    it('retries a fully clipped element on a throttle instead of spinning', () => {
        const onMove = vi.fn()
        observeMove(element, onMove)
        current().fire(rect, 1)
        const armed = current()
        armed.fire(rect, 0)
        expect(live()).toEqual([armed])
        vi.advanceTimersByTime(1000)
        expect(current()).not.toBe(armed)
        expect(current().threshold).toBe(1e-7)
        expect(onMove).not.toHaveBeenCalled()
    })

    it('does not arm a zero-size element', () => {
        observeMove(element, vi.fn())
        current().fire({ left: 0, top: 0, width: 0, height: 0 }, 0)
        expect(live()).toHaveLength(0)
    })

    it('stops watching on cleanup, even mid re-arm', () => {
        const onMove = vi.fn()
        const stop = observeMove(element, onMove)
        const plain = current()
        stop()
        expect(live()).toHaveLength(0)
        plain.fire(rect, 1)
        expect(live()).toHaveLength(0)
        expect(onMove).not.toHaveBeenCalled()
    })
})
