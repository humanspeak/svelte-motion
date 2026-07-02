import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { autoScrollIfNeeded, resetAutoScrollState } from './autoScroll'

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
    })

    afterEach(() => {
        resetAutoScrollState()
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
