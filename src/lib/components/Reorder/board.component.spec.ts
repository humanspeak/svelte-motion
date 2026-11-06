/**
 * `Reorder.Board`, pointer path: ports of Motion 14.10.1
 * `components/Reorder/__tests__/board.test.tsx` ("Reorder.Board",
 * "Reorder without a Board" and "Reorder with unmounted (e.g. virtualized)
 * items"), with its jsdom layout fixture (`:14-110`) verbatim. Fixtures are
 * in `__tests__/BoardHarness.svelte`.
 *
 * Svelte timing: React's `act()` maps to a flushed frame here. Where
 * upstream releases or moves the pointer "before React commits the move",
 * these tests run the frame synchronously (`vi.advanceTimersByTime`), so
 * Svelte's microtask flush hasn't rendered the move yet.
 *
 * Adapted rather than skipped:
 * - "doesn't keep their elements with a callback ref that returns a
 *   cleanup": React callback refs have no Svelte equivalent, so the third
 *   case binds each item's `ref` instead.
 *
 * "Reorder.Board keyboard" ports all 15 upstream keyboard tests. Upstream's
 * `act()` around one key is `press` (dispatch, then `flushSync`); several
 * keys in one `act()` ("before React renders") are `send`s with no flush
 * between them, so Svelte hasn't rendered the first when the next lands.
 *
 * Skipped: none.
 */
import { render, screen } from '@testing-library/svelte'
import { visualElementStore } from 'motion-dom'
import { flushSync } from 'svelte'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import BoardHarness from './__tests__/BoardHarness.svelte'
import type { ReorderContextProps } from './context'

// jsdom has no ResizeObserver; the items' `layout` prop observes one.
class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

/**
 * JSDOM has no layout. Each group (ul) is a 100x300 column, 200px apart,
 * and each item (li) a 100x50 row in it, offset by its translate. Boxes are
 * derived from the DOM, so they follow Svelte's updates and Motion's
 * renders like real layout would. (Motion 14.10.1 `board.test.tsx:14-63`.)
 */
function box(left: number, top: number, width: number, height: number) {
    return {
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON() {}
    } as DOMRect
}

function translate({ transform }: CSSStyleDeclaration) {
    let x = 0
    let y = 0
    transform.replace(
        /translate(X|Y|3d)\((-?[\d.]+)px(?:, (-?[\d.]+)px)?/g,
        (_, type: string, a: string, b: string) => {
            if (type === 'Y') y += parseFloat(a)
            else x += parseFloat(a)
            if (type === '3d') y += parseFloat(b)
            return ''
        }
    )
    return { x, y }
}

function rect(this: HTMLElement): DOMRect {
    const group = this.closest('ul')
    // Or hidden, like display: none
    if (!group || this.closest('[hidden]')) return box(0, 0, 0, 0)

    // Or, with data-stacked, groups 350px apart down the page
    const order = Array.from(document.querySelectorAll('ul')).indexOf(group)
    const [left, top] = group.hasAttribute('data-stacked') ? [0, order * 350] : [order * 200, 0]
    if (this === group) return box(left, top, 100, 300)

    const { x, y } = translate(this.style)
    const index = Array.from(group.children).indexOf(this)
    return box(left + x, top + index * 50 + y, 100, 50)
}

/**
 * Elements under a point, topmost first: a moved (dragged) item is drawn
 * above other items, which are drawn above their groups.
 */
function elementsFromPoint(x: number, y: number) {
    const isUnder = (element: Element) => {
        const { left, top, right, bottom } = element.getBoundingClientRect()
        return x >= left && x < right && y >= top && y < bottom
    }
    const isMoved = (element: Element) =>
        translate((element as HTMLElement).style).x || translate((element as HTMLElement).style).y
            ? 0
            : 1
    const items = Array.from(document.querySelectorAll('li'))
        .filter(isUnder)
        .sort((a, b) => isMoved(a) - isMoved(b))
    const groups = Array.from(document.querySelectorAll('ul')).filter(isUnder)

    return [...items, ...groups, document.body]
}

/** A frame: rAF is a 0ms timer under the suite's fake timers. */
const nextFrame = () => vi.advanceTimersByTimeAsync(20)

/**
 * Pointer events at page (and, with no scroll, client) coordinates.
 */
function pointer(type: string, target: Element, x: number, y: number) {
    const event = new PointerEvent(type, {
        isPrimary: true,
        bubbles: true,
        pointerType: 'mouse',
        button: type === 'pointermove' ? -1 : 0,
        buttons: type === 'pointerup' ? 0 : 1
    })
    Object.defineProperties(event, {
        pageX: { configurable: true, value: x },
        pageY: { configurable: true, value: y },
        clientX: { configurable: true, value: x },
        clientY: { configurable: true, value: y }
    })
    target.dispatchEvent(event)
}

/**
 * Press an item at its centre, then move the pointer by an offset from
 * there, a frame at a time.
 */
function drag(element: HTMLElement) {
    const { left, top } = element.getBoundingClientRect()
    const start = { x: left + 50, y: top + 25 }
    const latest = { ...start }

    pointer('pointerdown', element, start.x, start.y)

    const controls = {
        to: async (x: number, y: number) => {
            latest.x = start.x + x
            latest.y = start.y + y
            pointer('pointermove', document.body, latest.x, latest.y)
            await nextFrame()
            return controls
        },
        end: async () => {
            pointer('pointerup', document.body, latest.x, latest.y)
            await nextFrame()
        }
    }

    return controls
}

beforeAll(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterAll(() => {
    vi.unstubAllGlobals()
})

beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(rect)
    document.elementsFromPoint = elementsFromPoint
})

afterEach(async () => {
    // End any gesture a failed test left open, releasing its drag lock
    pointer('pointerup', document.body, 0, 0)
    await nextFrame()
    vi.restoreAllMocks()
    delete (document as { elementsFromPoint?: unknown }).elementsFromPoint
})

type Lists = Record<string, string[]>

const lists = (container: HTMLElement) =>
    Object.fromEntries(
        Array.from(container.querySelectorAll('ul')).map((group) => [
            group.dataset.testid,
            Array.from(group.children).map((item) => (item as HTMLElement).dataset.testid)
        ])
    )

const offset = (element: Element) => {
    const visualElement = visualElementStore.get(element)!
    return {
        x: Math.round(visualElement.getValue('x')!.get() as number),
        y: Math.round(visualElement.getValue('y')!.get() as number)
    }
}

/**
 * Whether an item's whileDrag state is active. Items need an animation
 * prop, like whileDrag, to have an animation state.
 */
const isGrabbed = (element: Element) =>
    !!visualElementStore.get(element)?.animationState?.getState().whileDrag.isActive

const byId = (id: string) => screen.getByTestId(id)

/** Render a fixture and let its items measure their layout. */
const setup = async (props: Record<string, unknown> = {}) => {
    const result = render(BoardHarness, props)
    await nextFrame()
    return result
}

const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms)

describe('Reorder.Board', () => {
    it('a drag continues on the element that replaces it', async () => {
        const onDragEnd = vi.fn()
        const { container } = await setup({ initial: { A: ['a', 'b'], B: ['c'] }, onDragEnd })

        const original = byId('a')
        const gesture = await drag(original).to(200, 40)
        await nextFrame()

        // It's in B now, as a new element
        const moved = byId('a')
        expect(moved).not.toBe(original)
        expect(moved.closest('ul')).toBe(byId('B'))
        expect(lists(container)).toEqual({ A: ['b'], B: ['c', 'a'] })

        // A further move moves the new element
        const before = moved.style.transform
        await gesture.to(220, 60)
        expect(moved.style.transform).not.toBe(before)

        // Release ends the drag on the new element, once
        await gesture.end()
        await nextFrame()
        expect(onDragEnd).toHaveBeenCalledTimes(1)
        expect(byId('a')).toBe(moved)
        expect(moved.isConnected).toBe(true)
    })

    it('moves an item into the group its centre is dragged over', async () => {
        const onReorder = vi.fn()
        const { container } = await setup({
            initial: { A: ['a', 'b'], B: ['c', 'd'] },
            onReorder
        })

        // Between the groups: nothing moves
        const gesture = await drag(byId('a')).to(100, 10)
        expect(onReorder).not.toHaveBeenCalled()

        // The centre of "a" is now at y=65 over B, past "c" (25) and
        // before "d" (75)
        await gesture.to(200, 40)
        expect(onReorder).toHaveBeenCalledTimes(2)
        expect(onReorder).toHaveBeenCalledWith('A', ['b'], 'a')
        expect(onReorder).toHaveBeenCalledWith('B', ['c', 'a', 'd'], 'a')
        expect(lists(container)).toEqual({ A: ['b'], B: ['c', 'a', 'd'] })

        await gesture.end()
    })

    it('keeps dragging the item from where it was in its new group', async () => {
        const { container } = await setup({ initial: { A: ['a', 'b'], B: ['c', 'd'] } })

        const gesture = await drag(byId('a')).to(200, 40)
        expect(lists(container)).toEqual({ A: ['b'], B: ['c', 'a', 'd'] })

        // Its new slot is 10px below where it was dragged to
        const moved = byId('a')
        expect(moved.closest('ul')).toBe(byId('B'))
        expect(offset(moved)).toEqual({ x: 0, y: -10 })

        // It follows the pointer from there
        await gesture.to(210, 60)
        expect(offset(moved)).toEqual({ x: 10, y: 10 })

        // And reorders within its new group: its bottom edge (110 + 50)
        // passes the centre of "d" (125)
        await gesture.to(210, 120)
        expect(lists(container)).toEqual({ A: ['b'], B: ['c', 'd', 'a'] })

        await gesture.end()
    })

    it('appends past the last item, and into an empty group', async () => {
        const { container } = await setup({ initial: { A: ['a', 'b'], B: ['c'], C: [] } })

        const gesture = await drag(byId('a')).to(200, 100)
        expect(lists(container)).toEqual({ A: ['b'], B: ['c', 'a'], C: [] })

        await gesture.to(400, 100)
        expect(lists(container)).toEqual({ A: ['b'], B: ['c'], C: ['a'] })

        await gesture.end()
    })

    it('moves the item back to a group it came from', async () => {
        const { container } = await setup({ initial: { A: ['a', 'b'], B: ['c', 'd'] } })

        const gesture = await drag(byId('a')).to(200, 0)
        expect(lists(container)).toEqual({ A: ['b'], B: ['a', 'c', 'd'] })

        await gesture.to(0, 0)
        expect(lists(container)).toEqual({ A: ['a', 'b'], B: ['c', 'd'] })

        await gesture.end()
    })

    it('snaps the item into its new slot on release, and ends the drag once', async () => {
        const onDragStart = vi.fn()
        const onDragEnd = vi.fn()
        const { container } = await setup({
            initial: { A: ['a'], B: ['b'] },
            onDragStart,
            onDragEnd,
            dragTransition: { bounceStiffness: 100000, bounceDamping: 100000 }
        })

        const gesture = await drag(byId('a')).to(200, 60)
        await gesture.to(200, 70)
        await gesture.end()
        expect(lists(container)).toEqual({ A: [], B: ['b', 'a'] })

        const moved = byId('a')
        await wait(500)
        expect(offset(moved)).toEqual({ x: 0, y: 0 })
        expect(onDragStart).toHaveBeenCalledTimes(1)
        expect(onDragEnd).toHaveBeenCalledTimes(1)
    })

    it('keeps whileDrag on the moved item', async () => {
        await setup({ initial: { A: ['a'], B: ['b'] }, whileDrag: { opacity: 0.5 } })

        const gesture = await drag(byId('a')).to(200, 60)
        expect(byId('a').closest('ul')).toBe(byId('B'))

        // Its drag carries on from the next frame
        await nextFrame()
        expect(isGrabbed(byId('a'))).toBe(true)

        await gesture.end()
        expect(isGrabbed(byId('a'))).toBe(false)
    })

    it("ends the drag if it's released before the drag carries on", async () => {
        const onDragEnd = vi.fn()
        const { container } = await setup({
            initial: { A: ['a'], B: ['b'] },
            whileDrag: { opacity: 0.5 },
            onDragEnd
        })

        await drag(byId('a')).to(100, 10)

        // Over B, and released in the same task, before Svelte renders the move
        pointer('pointermove', document.body, 250, 85)
        vi.advanceTimersByTime(20)
        expect(byId('a').closest('ul')).toBe(byId('A'))
        pointer('pointerup', document.body, 250, 85)
        await nextFrame()

        expect(lists(container)).toEqual({ A: [], B: ['b', 'a'] })
        expect(isGrabbed(byId('a'))).toBe(false)
        expect(onDragEnd).toHaveBeenCalledTimes(1)
    })

    it('carries the drag on from where the pointer is when Svelte renders the move', async () => {
        await setup({ initial: { A: ['a', 'b'], B: ['c', 'd'] } })

        const gesture = await drag(byId('a')).to(100, 10)

        // Over B, then on another 30px before Svelte renders the move
        pointer('pointermove', document.body, 250, 65)
        vi.advanceTimersByTime(20)
        pointer('pointermove', document.body, 280, 65)
        vi.advanceTimersByTime(20)
        await nextFrame()

        // Its slot's centre is at 250, 75: it's still under the pointer
        const moved = byId('a')
        expect(moved.closest('ul')).toBe(byId('B'))
        expect(offset(moved)).toEqual({ x: 30, y: -10 })

        await gesture.end()
    })

    it('carries how the item looks into its new group', async () => {
        await setup({
            initial: { A: ['a'], B: ['b'] },
            whileDrag: { scale: 1.5 },
            transition: { duration: 0.05 }
        })
        const scale = () => visualElementStore.get(byId('a'))!.getValue('scale')?.get()

        const gesture = await drag(byId('a')).to(100, 10)
        await wait(200)
        expect(scale()).toBe(1.5)

        // Its whileDrag doesn't start over in its new group
        await gesture.to(200, 60)
        expect(byId('a').closest('ul')).toBe(byId('B'))
        expect(scale()).toBe(1.5)

        // And ends on release
        await gesture.end()
        await wait(200)
        expect(scale()).toBe(1)
    })

    it('lets items in a board move on both axes', async () => {
        await setup({ initial: { A: ['a', 'b'] } })

        const gesture = await drag(byId('a')).to(30, 10)
        expect(offset(byId('a'))).toEqual({ x: 30, y: 10 })

        await gesture.end()
    })

    it("leaves the item where it is if the groups don't take it", async () => {
        const { container } = await setup({
            initial: { A: ['a', 'b'], B: ['c', 'd'] },
            reject: () => true
        })

        const gesture = await drag(byId('a')).to(200, 40)
        await gesture.to(210, 50)
        expect(lists(container)).toEqual({ A: ['a', 'b'], B: ['c', 'd'] })

        // Still dragged by the same gesture
        expect(offset(byId('a'))).toEqual({ x: 210, y: 50 })

        await gesture.end()
    })

    it('works with Reorder from the m entry in LazyMotion', async () => {
        const { container } = await setup({
            initial: { A: ['a', 'b'], B: ['c', 'd'] },
            lazy: true
        })

        const gesture = await drag(byId('a')).to(200, 40)
        expect(lists(container)).toEqual({ A: ['b'], B: ['c', 'a', 'd'] })
        await gesture.end()
    })

    it("scrolls the container around the groups across them, rather than the item's column", async () => {
        await setup({ variant: 'scrolling', initial: { A: ['a'], B: ['b'], C: [] } })

        /**
         * A 400px wide board that scrolls across to its last group, around
         * columns that scroll down. A browser computes a column's
         * overflow-x as auto too, and an item dragged out of it widens its
         * scrollable overflow, so it can scroll across a little as well.
         */
        const scrollLeft = (element: HTMLElement) => {
            let value = 0
            Object.defineProperty(element, 'scrollLeft', {
                get: () => value,
                set: (latest) => (value = latest)
            })
            return () => value
        }
        const metrics = (element: HTMLElement, getRect: () => DOMRect, scrollWidth: number) => {
            element.style.overflowX = 'auto'
            element.style.overflowY = 'auto'
            element.getBoundingClientRect = getRect
            const { width, height } = getRect()
            Object.defineProperties(element, {
                clientWidth: { value: width },
                clientHeight: { value: height },
                scrollWidth: { value: scrollWidth },
                scrollHeight: { value: height }
            })
            return scrollLeft(element)
        }

        const board = metrics(byId('board'), () => box(0, 0, 400, 300), 600)
        const columns = ['A', 'B', 'C'].map((id) => {
            const group = byId(id)
            return metrics(byId(`${id}-column`), () => group.getBoundingClientRect(), 250)
        })

        // Into B, then on towards the board's right edge, short of C
        const gesture = await drag(byId('a')).to(200, 0)
        expect(byId('a').closest('ul')).toBe(byId('B'))
        await gesture.to(320, 0)
        await gesture.to(340, 0)

        expect(board()).toBeGreaterThan(0)
        expect(columns.map((column) => column())).toEqual([0, 0, 0])

        await gesture.end()
    })

    it('drops into a virtualized group by the items it shows', async () => {
        let latest: Lists = {}
        const { rerender } = await setup({
            variant: 'virtualized',
            initial: { A: ['a'], B: ['c', 'd', 'e'] },
            shown: 3,
            onLists: (next: Lists) => (latest = next)
        })

        // Scrolled: only "c" is still rendered, "d" and "e" stay in values
        await rerender({ shown: 1 })
        await nextFrame()

        // Its centre just below "c"
        const gesture = await drag(byId('a')).to(200, 35)
        expect(latest).toEqual({ A: [], B: ['c', 'a', 'd', 'e'] })
        await gesture.end()
    })

    it('lets the item move again in a later gesture once the groups refused it', async () => {
        let refuse = true
        const { container } = await setup({
            initial: { A: ['a', 'b'], B: ['c', 'd'] },
            reject: () => refuse,
            dragTransition: { bounceStiffness: 100000, bounceDamping: 100000 }
        })

        let gesture = await drag(byId('a')).to(200, 40)
        await gesture.end()
        await wait(300)
        expect(offset(byId('a'))).toEqual({ x: 0, y: 0 })

        refuse = false
        gesture = await drag(byId('a')).to(200, 40)
        await gesture.to(200, 41)
        expect(lists(container)).toEqual({ A: ['b'], B: ['c', 'a', 'd'] })
        await gesture.end()
    })

    it('leaves the item in its group while canMove refuses the move', async () => {
        const onReorder = vi.fn()
        // Up to two items in a group
        const canMove = vi.fn((_: string, __: string[], to: string[]) => to.length < 2)
        const { container } = await setup({
            initial: { A: ['a', 'b'], B: ['c', 'd'], C: [] },
            onReorder,
            canMove
        })

        // Over B, which is full
        const gesture = await drag(byId('a')).to(200, 10)
        expect(canMove).toHaveBeenCalledWith('a', ['a', 'b'], ['c', 'd'])
        expect(onReorder).not.toHaveBeenCalled()
        expect(lists(container)).toEqual({ A: ['a', 'b'], B: ['c', 'd'], C: [] })
        expect(offset(byId('a'))).toEqual({ x: 200, y: 10 })

        // The same gesture can still take it on to C
        await gesture.to(400, 10)
        expect(lists(container)).toEqual({ A: ['b'], B: ['c', 'd'], C: ['a'] })
        expect(canMove).toHaveBeenLastCalledWith('a', ['a', 'b'], [])

        await gesture.end()
    })

    it("doesn't move items between a group and a group inside its items", async () => {
        const { container } = await setup({ variant: 'columns' })
        // Which column holds which cards. Columns may reorder among themselves.
        const state = () => {
            const { columns, ...cards } = lists(container)
            return { columns: [...columns].sort(), ...cards }
        }
        const initial = state()

        // A card over the list of columns, outside any list of cards
        let gesture = await drag(byId('a')).to(-170, 0)
        expect(state()).toEqual(initial)
        await gesture.end()

        // A column over another column's cards
        gesture = await drag(byId('y')).to(200, -50)
        expect(state()).toEqual(initial)
        await gesture.end()
    })

    it('carries on after the dragged item unmounts mid-drag', async () => {
        const { container, component } = await setup({ initial: { A: ['a', 'b'], B: ['c'] } })

        const gesture = await drag(byId('a')).to(10, 10)
        // The app removes it
        component.setLists((latest: Lists) => ({ ...latest, A: ['b'] }))
        await nextFrame()
        await gesture.to(20, 20)
        await gesture.end()

        // Items still move between groups
        const next = await drag(byId('b')).to(200, 40)
        await next.to(200, 41)
        expect(lists(container)).toEqual({ A: [], B: ['c', 'b'] })
        await next.end()
    })
})

describe('Reorder without a Board', () => {
    it("doesn't move items between groups", async () => {
        const onReorder = vi.fn()
        await setup({
            variant: 'noBoard',
            initial: { A: ['a', 'b'], C: ['c', 'd'] },
            onReorder
        })

        const gesture = await drag(byId('a')).to(200, 40)
        expect(onReorder).not.toHaveBeenCalledWith('C', expect.anything(), expect.anything())
        expect(byId('a').closest('ul')!.contains(byId('b'))).toBe(true)
        // And it only moves along its axis
        expect(offset(byId('a')).x).toBe(0)

        await gesture.end()
    })
})

describe('Reorder with unmounted (e.g. virtualized) items', () => {
    it.each([
        ['outside a Board', false, false],
        ['inside a Board', true, false],
        // Upstream: a callback ref that returns a cleanup. Svelte: a bound ref.
        ['with a bound ref', false, true]
    ])("doesn't keep their elements %s", async (_, inBoard, bindRef) => {
        const captured: { context?: ReorderContextProps<number> } = {}
        const { rerender } = await setup({
            variant: 'unmounted',
            inBoard,
            bindRef,
            from: 0,
            onCapture: (context: ReorderContextProps<number>) => (captured.context = context)
        })
        await rerender({ from: 3 })
        await nextFrame()

        // Elements no longer in the document. Ours keeps them as getters in
        // `elements`, rather than as refs in `getOrder()`'s data.
        const context = captured.context!
        const order = context.getOrder()
        const detached = order.filter(
            ({ value }) => context.elements.get(value)?.()?.isConnected === false
        )
        expect(order.map(({ value }) => value)).toEqual([3, 4, 5])
        expect(detached).toEqual([])
        const stale = [...context.elements.values()].filter((get) => get()?.isConnected === false)
        expect(stale).toEqual([])
    })
})

describe('Reorder.Board keyboard', () => {
    /**
     * Dispatch a keydown and flush Svelte's updates (upstream `act()`).
     * Returns whether the key was left to the browser (not prevented).
     */
    const press = (element: Element, key: string) => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
        element.dispatchEvent(event)
        flushSync()
        return !event.defaultPrevented
    }

    /**
     * Dispatch a keydown without flushing: Svelte renders on a microtask, so
     * keys sent back to back all land before it renders (upstream: several
     * `fireEvent`s in one `act()`).
     */
    const send = (element: Element, key: string) =>
        element.dispatchEvent(
            new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
        )

    const focus = (element: HTMLElement) => {
        element.focus()
        flushSync()
    }

    const keyboardSetup = (initial: Lists = { A: ['a', 'b'], B: ['c', 'd'] }) => {
        const onReorder = vi.fn()
        return setup({
            initial,
            onReorder,
            whileDrag: { opacity: 0.5 },
            /**
             * Without layout animations: a keyboard move lands by where
             * the items are drawn, so an item still animating into its
             * slot would make the slot depend on timing.
             *
             * Svelte: `layout: false` as well. With only `type: false`, a
             * sibling's FLIP transform (after the item leaves its group)
             * can stay at its starting delta in jsdom, depending on which
             * tests ran first in the worker, and the next move lands by
             * that stale position. Items still measure their slots.
             */
            transition: { type: false },
            layout: false
        }).then((result) => ({ onReorder, ...result }))
    }

    it('moves a grabbed item to the next group across its axis', async () => {
        const { container } = await keyboardSetup()

        const a = byId('a')
        focus(a)
        press(a, ' ')

        expect(press(a, 'ArrowRight')).toBe(false)
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['b'], B: ['a', 'c', 'd'] })

        // Focus and the grab move with it
        const moved = byId('a')
        expect(moved.closest('ul')).toBe(byId('B'))
        expect(document.activeElement).toBe(moved)
        expect(isGrabbed(moved)).toBe(true)

        // Arrows along the axis now move it within its new group
        press(moved, 'ArrowDown')
        expect(lists(container)).toEqual({ A: ['b'], B: ['c', 'a', 'd'] })

        press(moved, 'ArrowLeft')
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['b', 'a'], B: ['c', 'd'] })
        expect(document.activeElement).toBe(byId('a'))

        // Space drops it
        press(byId('a'), ' ')
        expect(isGrabbed(byId('a'))).toBe(false)
    })

    it('moves to another group on an arrow sent before Svelte renders the grab', async () => {
        const { container } = await keyboardSetup()

        const a = byId('a')
        focus(a)
        // As Playwright can send them: both keys before Svelte renders
        send(a, ' ')
        send(a, 'ArrowRight')
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['b'], B: ['a', 'c', 'd'] })
        expect(document.activeElement).toBe(byId('a'))
        expect(isGrabbed(byId('a'))).toBe(true)
    })

    it("leaves arrows to the browser where there's no group", async () => {
        const { onReorder } = await keyboardSetup()

        const a = byId('a')
        press(a, ' ')
        expect(press(a, 'ArrowLeft')).toBe(true)
        expect(onReorder).not.toHaveBeenCalled()
    })

    it('restores the item to the group and slot it was grabbed from on Escape', async () => {
        const { container } = await keyboardSetup()

        const b = byId('b')
        focus(b)
        press(b, ' ')
        press(b, 'ArrowRight')
        await nextFrame()
        press(byId('b'), 'ArrowDown')
        expect(lists(container)).toEqual({ A: ['a'], B: ['c', 'd', 'b'] })

        expect(press(byId('b'), 'Escape')).toBe(false)
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['a', 'b'], B: ['c', 'd'] })
        expect(document.activeElement).toBe(byId('b'))
        expect(isGrabbed(byId('b'))).toBe(false)
    })

    it("doesn't move a grabbed item into a hidden group", async () => {
        const { container } = await setup({
            initial: { H: ['h'], A: ['a'], B: ['b'] },
            hidden: 'H',
            whileDrag: { opacity: 0.5 }
        })

        const a = byId('a')
        focus(a)
        press(a, ' ')
        expect(press(a, 'ArrowLeft')).toBe(true)
        expect(lists(container)).toEqual({ H: ['h'], A: ['a'], B: ['b'] })
        expect(document.activeElement).toBe(a)
    })

    it('forgets a refused move once the item is dropped', async () => {
        let refuse = true
        const { container, component } = await setup({
            initial: { A: ['a', 'b'], B: ['c'] },
            reject: () => refuse,
            whileDrag: { opacity: 0.5 }
        })

        const a = byId('a')
        focus(a)
        press(a, ' ')
        press(a, 'ArrowRight')
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['a', 'b'], B: ['c'] })
        press(a, ' ')
        focus(byId('c'))

        // Later, the app moves it itself
        refuse = false
        component.setLists((latest: Lists) => ({ A: ['b'], B: ['a', ...latest.B] }))
        flushSync()
        await nextFrame()

        expect(document.activeElement).toBe(byId('c'))
        expect(isGrabbed(byId('a'))).toBe(false)
    })

    it('skips a group that canMove refuses for the next one that way', async () => {
        const { container } = await setup({
            initial: { A: ['a'], B: ['b', 'c'], C: [], D: ['d', 'e'] },
            // Up to two items in a group
            canMove: (_: string, __: string[], to: string[]) => to.length < 2,
            whileDrag: { opacity: 0.5 }
        })

        const a = byId('a')
        focus(a)
        press(a, ' ')
        expect(press(a, 'ArrowRight')).toBe(false)
        await nextFrame()
        const moved = { A: [], B: ['b', 'c'], C: ['a'], D: ['d', 'e'] }
        expect(lists(container)).toEqual(moved)
        expect(document.activeElement).toBe(byId('a'))

        // No group takes it further that way
        expect(press(byId('a'), 'ArrowRight')).toBe(true)
        expect(lists(container)).toEqual(moved)
    })

    it('returns the item on Escape whatever canMove says', async () => {
        const { container } = await setup({
            initial: { A: ['a', 'b'], B: ['c'] },
            // Nothing moves into A
            canMove: (_: string, __: string[], to: string[]) => !to.includes('a'),
            whileDrag: { opacity: 0.5 }
        })

        const b = byId('b')
        focus(b)
        press(b, ' ')
        press(b, 'ArrowRight')
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['a'], B: ['c', 'b'] })

        press(byId('b'), 'Escape')
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['a', 'b'], B: ['c'] })
    })

    it('only moves past either end into a group that way, not one beside it', async () => {
        const { container } = await keyboardSetup({ A: ['a'], B: ['b'] })

        // A and B are side by side: neither's last item has anywhere to go
        // down, to the right or the left
        for (const id of ['a', 'b']) {
            const item = byId(id)
            focus(item)
            press(item, ' ')
            press(item, 'ArrowDown')
            await nextFrame()
            expect(lists(container)).toEqual({ A: ['a'], B: ['b'] })
            expect(document.activeElement).toBe(byId(id))
            press(byId(id), ' ')
        }
    })

    it('moves past either end into the group that way', async () => {
        const { container } = await setup({
            initial: { A: ['a', 'b'], B: ['c'] },
            stacked: true,
            whileDrag: { opacity: 0.5 }
        })

        const b = byId('b')
        focus(b)
        press(b, ' ')
        expect(press(b, 'ArrowDown')).toBe(false)
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['a'], B: ['b', 'c'] })

        press(byId('b'), 'ArrowUp')
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['a', 'b'], B: ['c'] })
    })

    it("keeps Home and End within the item's group", async () => {
        const { container } = await setup({
            initial: { A: ['a', 'b'], B: ['c', 'd'] },
            stacked: true,
            whileDrag: { opacity: 0.5 }
        })

        const b = byId('b')
        focus(b)
        press(b, ' ')
        expect(press(b, 'End')).toBe(false)
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['a', 'b'], B: ['c', 'd'] })

        press(byId('b'), 'Home')
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['b', 'a'], B: ['c', 'd'] })

        press(byId('b'), 'Home')
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['b', 'a'], B: ['c', 'd'] })
        expect(document.activeElement).toBe(byId('b'))
    })

    it('waits for a move to another group to render before moving the item again', async () => {
        const { container } = await keyboardSetup()

        const a = byId('a')
        focus(a)
        // As a test runner can send them, or as a user can type before
        // Svelte renders the move: all before it renders
        send(a, ' ')
        send(a, 'ArrowRight')
        send(a, 'ArrowDown')
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['b'], B: ['a', 'c', 'd'] })

        // Once it has, arrows move it again
        press(byId('a'), 'ArrowDown')
        expect(lists(container)).toEqual({ A: ['b'], B: ['c', 'a', 'd'] })
    })

    it('waits for a move to another group to render before returning the item on Escape', async () => {
        const { container } = await keyboardSetup()

        const a = byId('a')
        focus(a)
        press(a, ' ')
        press(a, 'ArrowDown')
        expect(lists(container)).toEqual({ A: ['b', 'a'], B: ['c', 'd'] })

        // Escape before Svelte renders the move
        send(byId('a'), 'ArrowRight')
        send(byId('a'), 'Escape')
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['b'], B: ['c', 'a', 'd'] })
        expect(document.activeElement).toBe(byId('a'))

        // Once it has, Escape returns it
        press(byId('a'), 'Escape')
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['a', 'b'], B: ['c', 'd'] })
    })

    it('leaves focus where it is when a keyboard move lands later', async () => {
        const { container, component } = await setup({
            initial: { A: ['a', 'b'], B: ['c'] },
            // Only the group it joins ignores the move: the item disappears
            reject: (id: string) => id === 'B',
            whileDrag: { opacity: 0.5 }
        })

        const a = byId('a')
        focus(a)
        press(a, ' ')
        press(a, 'ArrowRight')
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['b'], B: ['c'] })

        // The user carries on elsewhere
        focus(byId('c'))

        // Later (e.g. an undo), the app puts it there itself
        component.setLists((latest: Lists) => ({ ...latest, B: ['c', 'a'] }))
        flushSync()
        await nextFrame()

        expect(document.activeElement).toBe(byId('c'))
        expect(isGrabbed(byId('a'))).toBe(false)
    })

    it('moves an item again after a keyboard move that never landed', async () => {
        const { container, component } = await setup({
            initial: { A: ['a', 'b'], B: ['c'] },
            // Only the group it joins ignores the move: the item disappears
            reject: (id: string) => id === 'B',
            whileDrag: { opacity: 0.5 }
        })

        const a = byId('a')
        focus(a)
        press(a, ' ')
        press(a, 'ArrowRight')
        await nextFrame()
        expect(lists(container)).toEqual({ A: ['b'], B: ['c'] })

        // The app puts it back (e.g. an undo), and it's grabbed again
        component.setLists((latest: Lists) => ({ ...latest, A: ['a', 'b'] }))
        flushSync()
        await nextFrame()
        const restored = byId('a')
        focus(restored)
        press(restored, ' ')
        expect(press(restored, 'ArrowDown')).toBe(false)
        expect(lists(container)).toEqual({ A: ['b', 'a'], B: ['c'] })
    })
})
