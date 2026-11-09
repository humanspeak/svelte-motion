import { afterEach, describe, expect, it, vi } from 'vitest'
import { centre, createBoard, isBefore, isNested, pageCentre, type BoardProps } from './board'
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

describe('createBoard key', () => {
    /** A real element (for `contains` and computed style) with a fixed rect. */
    const sized = <K extends keyof HTMLElementTagNameMap>(
        tag: K,
        left: number,
        top: number,
        width: number,
        height: number
    ) => {
        const node = document.createElement(tag)
        node.getBoundingClientRect = () =>
            ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect
        document.body.append(node)
        return node
    }

    /**
     * A group context with a stubbed element, whose spied `onReorder`
     * applies the new values as an app would.
     */
    const fakeGroup = (left: number, top: number, width = 100, height = 300, values = ['x']) => {
        const element = sized('ul', left, top, width, height)
        const group = {
            axis: 'y',
            values,
            elements: new Map(),
            getOrder: () => [],
            getGroupElement: () => element,
            onReorder: vi.fn((next: string[]) => {
                group.values = next
            }),
            markReordered: vi.fn()
        }
        return group as unknown as ReorderContextProps<unknown> & {
            onReorder: ReturnType<typeof vi.fn>
        }
    }

    afterEach(() => {
        document.body.replaceChildren()
    })

    /** A board of `groups`. */
    const setup = (groups: ReorderContextProps<unknown>[], props: BoardProps = {}) => {
        const board = createBoard(() => props)
        for (const group of groups) board.add(group)
        return board
    }

    // An item 100x50 centred at (250, 125): a column at x 200-300
    const item = () => sized('li', 200, 100, 100, 50)

    it.each([
        // keyIndex, the key, and which of the groups around it it moves into
        [0, 'ArrowUp', 'above'],
        [1, 'ArrowLeft', 'left'],
        [2, 'ArrowDown', 'below'],
        [3, 'ArrowRight', 'right']
    ] as const)('%s (%s) moves into the nearest group %s', (keyIndex, _, name) => {
        const from = fakeGroup(200, 0, 100, 300, ['a'])
        const around = {
            above: fakeGroup(200, -400),
            left: fakeGroup(0, 0),
            below: fakeGroup(200, 400),
            right: fakeGroup(400, 0)
        }
        const board = setup([from, ...Object.values(around)])

        expect(board.key(from, 'a', keyIndex, item(), ['a'])).toBe(true)
        for (const [key, group] of Object.entries(around)) {
            expect(group.onReorder).toHaveBeenCalledTimes(key === name ? 1 : 0)
        }
        expect(from.onReorder).toHaveBeenCalledWith([], 'a')
    })

    it("needs the group's near edge past the item's centre that way", () => {
        const from = fakeGroup(200, 0)
        // Beside it, starting at its centre: not past it
        const beside = fakeGroup(250, 0)
        const board = setup([from, beside])

        expect(board.key(from, 'a', 3, item(), ['a'])).toBe(false)
        expect(beside.onReorder).not.toHaveBeenCalled()
    })

    it('picks the nearest of the groups that way', () => {
        const from = fakeGroup(200, 0)
        const far = fakeGroup(800, 0)
        const near = fakeGroup(400, 0)
        const board = setup([from, far, near])

        expect(board.key(from, 'a', 3, item(), ['a'])).toBe(true)
        expect(near.onReorder).toHaveBeenCalledWith(['x', 'a'], 'a')
        expect(far.onReorder).not.toHaveBeenCalled()
    })

    it('skips hidden groups, and groups canMove refuses', () => {
        const from = fakeGroup(200, 0)
        const hidden = fakeGroup(400, 0, 0, 0)
        const refused = fakeGroup(600, 0, 100, 300, ['full'])
        const open = fakeGroup(800, 0)
        const board = setup([from, hidden, refused, open], {
            canMove: (_, __, to) => !(to as string[]).includes('full')
        })

        expect(board.key(from, 'a', 3, item(), ['a'])).toBe(true)
        expect(hidden.onReorder).not.toHaveBeenCalled()
        expect(refused.onReorder).not.toHaveBeenCalled()
        expect(open.onReorder).toHaveBeenCalled()
    })

    it("is moving until it's picked up, and restores to where it was grabbed", () => {
        const from = fakeGroup(200, 0, 100, 300, ['a', 'b'])
        const to = fakeGroup(400, 0)
        const board = setup([from, to])
        const element = item()
        const grabbed = ['a', 'b']

        expect(board.isMoving(element)).toBe(false)
        board.key(from, 'a', 3, element, grabbed)
        expect(board.isMoving(element)).toBe(true)
        board.end('a')
        expect(board.isMoving(element)).toBe(false)

        // From its new group, back before "b"
        expect(board.restore(to, 'a', element, grabbed)).toBe(true)
        expect(from.values).toEqual(['a', 'b'])
        expect(to.values).toEqual(['x'])
        // Only once
        expect(board.restore(to, 'a', element, grabbed)).toBe(false)
    })

    it("doesn't restore within the group it was grabbed in", () => {
        const from = fakeGroup(200, 0)
        const board = setup([from, fakeGroup(400, 0)])
        const grabbed = ['a']
        board.key(from, 'a', 3, item(), grabbed)
        expect(board.restore(from, 'a', item(), grabbed)).toBe(false)
    })
})
