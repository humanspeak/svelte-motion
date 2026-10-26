import { frameData } from 'motion-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { autoScrollIfNeeded, resetAutoScrollState, selectAutoScrollAxis } from './autoScroll'

const originalFrameDelta = frameData.delta

describe('selectAutoScrollAxis', () => {
    it('preserves a one-dimensional group axis', () => {
        expect(selectAutoScrollAxis('x', { x: 0, y: 100 })).toBe('x')
        expect(selectAutoScrollAxis('y', { x: 100, y: 0 })).toBe('y')
    })

    it('selects the dominant velocity axis for xy and prefers y on ties', () => {
        expect(selectAutoScrollAxis('xy', { x: 20, y: 5 })).toBe('x')
        expect(selectAutoScrollAxis('xy', { x: 5, y: -20 })).toBe('y')
        expect(selectAutoScrollAxis('xy', { x: 10, y: -10 })).toBe('y')
    })
})

/**
 * jsdom performs no layout, so the scroll container's geometry and
 * overflow style are stubbed directly on the elements under test.
 */
const makeScrollableList = () => {
    const scroller = document.createElement('div')
    scroller.style.overflowY = 'scroll'
    Object.defineProperty(scroller, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(scroller, 'scrollHeight', { value: 600, configurable: true })
    scroller.getBoundingClientRect = () =>
        ({ top: 0, bottom: 200, left: 0, right: 100, width: 100, height: 200 }) as DOMRect

    const group = document.createElement('ul')
    scroller.appendChild(group)
    document.body.appendChild(scroller)
    return { scroller, group }
}

describe('autoScrollIfNeeded', () => {
    beforeEach(() => {
        document.body.innerHTML = ''
        // autoScrollIfNeeded runs from onDrag, inside a frame. Default to 60fps.
        frameData.delta = 1000 / 60
    })

    afterEach(() => {
        resetAutoScrollState()
        frameData.delta = originalFrameDelta
    })

    it('does nothing without a scrollable ancestor', () => {
        const group = document.createElement('ul')
        document.body.appendChild(group)
        expect(() => autoScrollIfNeeded(group, 195, 'y', 5)).not.toThrow()
    })

    it('scrolls toward the end edge when velocity points at it', () => {
        const { scroller, group } = makeScrollableList()
        autoScrollIfNeeded(group, 195, 'y', 5)
        expect(scroller.scrollTop).toBeGreaterThan(0)
    })

    it('does not start scrolling when velocity points away from the edge', () => {
        const { scroller, group } = makeScrollableList()
        autoScrollIfNeeded(group, 195, 'y', -5)
        expect(scroller.scrollTop).toBe(0)
    })

    it('keeps scrolling an activated edge even after velocity fades', () => {
        const { scroller, group } = makeScrollableList()
        autoScrollIfNeeded(group, 195, 'y', 5)
        const afterActivation = scroller.scrollTop
        autoScrollIfNeeded(group, 195, 'y', 0)
        expect(scroller.scrollTop).toBeGreaterThan(afterActivation)
    })

    it('caps forward scrolling at the limit captured on activation', () => {
        const { scroller, group } = makeScrollableList()
        scroller.scrollTop = 400 // already at scrollHeight - clientHeight
        autoScrollIfNeeded(group, 195, 'y', 5)
        expect(scroller.scrollTop).toBe(400)
    })

    it('resets edge activation once the pointer leaves the threshold zone', () => {
        const { scroller, group } = makeScrollableList()
        autoScrollIfNeeded(group, 195, 'y', 5)
        expect(scroller.scrollTop).toBeGreaterThan(0)
        const scrolled = scroller.scrollTop
        // Middle of the container: no zone → clears state.
        autoScrollIfNeeded(group, 100, 'y', 5)
        expect(scroller.scrollTop).toBe(scrolled)
        // Back at the edge but moving away: the velocity gate applies again.
        autoScrollIfNeeded(group, 195, 'y', -5)
        expect(scroller.scrollTop).toBe(scrolled)
    })
})

/**
 * Speed values match upstream framer-motion
 * `Reorder/utils/__tests__/auto-scroll.test.ts` @ v14.6.0. Speeds are in
 * px per millisecond, scaled by the frame's `frameData.delta`, so at the
 * default 60fps delta the per-frame distances match the old 25 px cap.
 */
describe('scroll speed', () => {
    /**
     * Same 200 px viewport as `makeScrollableList`, but a tall
     * `scrollHeight` so the forward-scroll limit never interferes, and a
     * starting `scrollTop` so start-edge scrolling isn't clamped at 0.
     */
    const makeTallScrollableList = () => {
        const { scroller, group } = makeScrollableList()
        Object.defineProperty(scroller, 'scrollHeight', { value: 5000, configurable: true })
        scroller.scrollTop = 1000
        return { scroller, group }
    }

    beforeEach(() => {
        document.body.innerHTML = ''
        // autoScrollIfNeeded runs from onDrag, inside a frame. Default to 60fps.
        frameData.delta = 1000 / 60
    })

    afterEach(() => {
        resetAutoScrollState()
        frameData.delta = originalFrameDelta
    })

    it('eases in near the end edge (25 px away)', () => {
        const { scroller, group } = makeTallScrollableList()
        autoScrollIfNeeded(group, 175, 'y', 5)
        expect(scroller.scrollTop - 1000).toBeCloseTo(6.25)
    })

    it('approaches maxSpeed close to the end edge (2 px away)', () => {
        const { scroller, group } = makeTallScrollableList()
        autoScrollIfNeeded(group, 198, 'y', 5)
        expect(scroller.scrollTop - 1000).toBeCloseTo(23.04, 2)
    })

    it('caps at maxSpeed when the pointer is past the end edge', () => {
        const { scroller, group } = makeTallScrollableList()
        autoScrollIfNeeded(group, 400, 'y', 5)
        expect(scroller.scrollTop - 1000).toBe(25)
    })

    it('caps at maxSpeed when the pointer is past the start edge', () => {
        const { scroller, group } = makeTallScrollableList()
        autoScrollIfNeeded(group, -100, 'y', -5)
        expect(1000 - scroller.scrollTop).toBe(25)
    })

    /**
     * Simulate holding the pointer 10 px inside the bottom edge for one
     * second at the given frame rate, returning the total distance scrolled.
     *
     * @param fps - Simulated display refresh rate.
     * @returns Total px scrolled over `fps` frames.
     */
    const scrollForOneSecond = (fps: number): number => {
        const { scroller, group } = makeTallScrollableList()
        resetAutoScrollState()
        frameData.delta = 1000 / fps
        for (let i = 0; i < fps; i++) {
            autoScrollIfNeeded(group, 190, 'y', 1)
        }
        return scroller.scrollTop - 1000
    }

    it("scroll speed is independent of the display's refresh rate", () => {
        const at60 = scrollForOneSecond(60)
        expect(at60).toBeCloseTo(960)
        expect(scrollForOneSecond(120)).toBeCloseTo(at60)
        expect(scrollForOneSecond(30)).toBeCloseTo(at60)
        expect(scrollForOneSecond(240)).toBeCloseTo(at60)
    })

    it("an extra mid-frame update doesn't scroll the frame's distance twice", () => {
        // A synchronous projection flush runs onDrag again a few ms into the
        // frame, and the following frame's delta is the remainder.
        const { scroller, group } = makeTallScrollableList()
        frameData.delta = 4
        autoScrollIfNeeded(group, 400, 'y', 5)
        frameData.delta = 1000 / 60 - 4
        autoScrollIfNeeded(group, 400, 'y', 5)
        expect(scroller.scrollTop - 1000).toBeCloseTo(25)
    })
})
