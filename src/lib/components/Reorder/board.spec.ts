import { describe, expect, it } from 'vitest'
import { centre, isBefore, isNested, pageCentre } from './board'
import type { ReorderContextProps } from './context'

/** An element with a fixed client rect, in a window scrolled by `scroll`. */
const element = (
    left: number,
    top: number,
    width: number,
    height: number,
    scroll = { x: 0, y: 0 }
) =>
    ({
        getBoundingClientRect: () =>
            ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect,
        ownerDocument: { defaultView: { scrollX: scroll.x, scrollY: scroll.y } }
    }) as unknown as Element

const group = (node: Element) =>
    ({ getGroupElement: () => node }) as unknown as ReorderContextProps<unknown>

describe('centre', () => {
    it("returns the centre of an element's client rect", () => {
        expect(centre(element(10, 20, 100, 50))).toEqual({ x: 60, y: 45 })
    })
})

describe('pageCentre', () => {
    it("adds the window's scroll to the centre", () => {
        expect(pageCentre(element(10, 20, 100, 50, { x: 5, y: 300 }))).toEqual({ x: 65, y: 345 })
    })

    it('equals the client centre without scroll', () => {
        expect(pageCentre(element(0, 0, 40, 40))).toEqual({ x: 20, y: 20 })
    })
})

describe('isBefore', () => {
    // A 100x50 item at (100, 100): centre (150, 125)
    const item = element(100, 100, 100, 50)

    it('compares x with the centre on the x axis', () => {
        expect(isBefore({ x: 149, y: 0 }, item, 'x', false)).toBe(true)
        expect(isBefore({ x: 150, y: 0 }, item, 'x', false)).toBe(true)
        expect(isBefore({ x: 151, y: 999 }, item, 'x', false)).toBe(false)
    })

    it('flips the x comparison in RTL', () => {
        expect(isBefore({ x: 151, y: 0 }, item, 'x', true)).toBe(true)
        expect(isBefore({ x: 150, y: 0 }, item, 'x', true)).toBe(false)
        expect(isBefore({ x: 100, y: 0 }, item, 'x', true)).toBe(false)
    })

    it('compares y with the centre on the y axis, whatever the direction', () => {
        expect(isBefore({ x: 999, y: 125 }, item, 'y', false)).toBe(true)
        expect(isBefore({ x: 999, y: 126 }, item, 'y', false)).toBe(false)
        expect(isBefore({ x: 0, y: 124 }, item, 'y', true)).toBe(true)
    })

    it('on xy, is before anything above the line, and before the centre on it', () => {
        // Above the item's line: before, wherever it is across
        expect(isBefore({ x: 999, y: 99 }, item, 'xy', false)).toBe(true)
        // On its line: by x
        expect(isBefore({ x: 120, y: 120 }, item, 'xy', false)).toBe(true)
        expect(isBefore({ x: 180, y: 120 }, item, 'xy', false)).toBe(false)
        // On its line in RTL: by x, flipped
        expect(isBefore({ x: 180, y: 120 }, item, 'xy', true)).toBe(true)
        // Below the line: after
        expect(isBefore({ x: 0, y: 150 }, item, 'xy', false)).toBe(false)
    })
})

describe('isNested', () => {
    it('is true when either group holds the other', () => {
        const outer = document.createElement('ul')
        const item = document.createElement('li')
        const inner = document.createElement('ul')
        item.append(inner)
        outer.append(item)
        expect(isNested(group(outer), group(inner))).toBe(true)
        expect(isNested(group(inner), group(outer))).toBe(true)
        expect(isNested(group(outer), group(outer))).toBe(true)
    })

    it('is false for unrelated groups', () => {
        const board = document.createElement('div')
        const a = document.createElement('ul')
        const b = document.createElement('ul')
        board.append(a, b)
        expect(isNested(group(a), group(b))).toBe(false)
    })
})
