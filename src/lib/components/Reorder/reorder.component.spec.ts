import { MotionDomProjectionAdapter } from '$lib/utils/motionDomProjection'
import { render, screen } from '@testing-library/svelte'
import { elementDragControls, visualElementStore } from 'motion-dom'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import ClickAfterDragHarness from './__tests__/ClickAfterDragHarness.svelte'
import DetectedAxisHarness from './__tests__/DetectedAxisHarness.svelte'
import ItemOutsideGroup from './__tests__/ItemOutsideGroup.svelte'
import ReorderHarness from './__tests__/ReorderHarness.svelte'

// jsdom has no ResizeObserver; the items' `layout` prop observes one.
class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

const activePointers = new Map<number, { clientX: number; clientY: number }>()

/** Advance the controlled Motion frame used to sample drag pointer events. */
const flushFrame = async (ms = 1) => {
    await vi.advanceTimersByTimeAsync(ms)
}

const dispatchMousePointer = (
    target: EventTarget,
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    {
        clientX,
        clientY,
        pageX = clientX,
        pageY = clientY,
        pointerId,
        bubbles = false
    }: {
        clientX: number
        clientY: number
        pageX?: number
        pageY?: number
        pointerId: number
        /** Let the event bubble, e.g. a press on an item's child button. */
        bubbles?: boolean
    }
) => {
    const event = new PointerEvent(type, {
        bubbles,
        clientX,
        clientY,
        pointerId,
        pointerType: 'mouse',
        isPrimary: true,
        button: type === 'pointermove' ? -1 : 0,
        buttons: type === 'pointerdown' || type === 'pointermove' ? 1 : 0
    })

    // jsdom aliases pageX/pageY to clientX/clientY because it doesn't model
    // document scrolling. Define the browser coordinates on the real event so
    // component regressions can exercise a scrolled-page gesture faithfully.
    Object.defineProperties(event, {
        pageX: { configurable: true, value: pageX },
        pageY: { configurable: true, value: pageY }
    })
    target.dispatchEvent(event)

    if (type === 'pointercancel' || type === 'pointerup') {
        activePointers.delete(pointerId)
    } else {
        activePointers.set(pointerId, { clientX, clientY })
    }
}

beforeAll(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterAll(() => {
    vi.unstubAllGlobals()
})

afterEach(async () => {
    try {
        for (const [pointerId, point] of [...activePointers]) {
            dispatchMousePointer(window, 'pointercancel', { ...point, pointerId })
        }
        await flushFrame()
    } finally {
        activePointers.clear()
        vi.restoreAllMocks()
    }
})

describe('Reorder.Group / Reorder.Item', () => {
    it('renders a ul with li items by default', async () => {
        render(ReorderHarness)
        const group = await screen.findByTestId('group')
        expect(group.tagName).toBe('UL')
        expect(group.querySelectorAll('li')).toHaveLength(3)
    })

    it('accepts an omitted axis for automatic detection', async () => {
        render(ReorderHarness)
        const group = await screen.findByTestId('group')
        expect(group.querySelectorAll('li')).toHaveLength(3)
    })

    it('propagates a post-measure detected axis into the item drag constraint', async () => {
        const getBoundingClientRect = vi
            .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
            .mockImplementation(function (this: HTMLElement) {
                if (this.dataset.testid === 'detected-item-0') {
                    return new DOMRect(0, 0, 100, 100)
                }
                if (this.dataset.testid === 'detected-item-1') {
                    return new DOMRect(110, 0, 100, 100)
                }
                return new DOMRect()
            })

        render(DetectedAxisHarness)
        const item = await screen.findByTestId('detected-item-0')

        await vi.advanceTimersByTimeAsync(1000)
        expect(getBoundingClientRect).toHaveBeenCalled()

        // The group and items mounted while the safe detected axis was `y`.
        // These post-mount horizontal measurements must rewire the existing
        // item's drag gesture before this diagonal pointer move.
        dispatchMousePointer(item, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
        dispatchMousePointer(window, 'pointermove', {
            clientX: 40,
            clientY: 30,
            pointerId: 1
        })
        await flushFrame()

        const visualElement = visualElementStore.get(item)
        expect(visualElement?.getValue('x')?.get()).toBe(30)
        expect(visualElement?.getValue('y')?.get()).toBe(0)

        dispatchMousePointer(window, 'pointercancel', {
            clientX: 40,
            clientY: 30,
            pointerId: 1
        })
        await flushFrame()
    })

    it('keeps the active pointer session alive when the group axis changes', async () => {
        const result = render(ReorderHarness, {
            props: { axis: 'x', values: [0, 1, 2] }
        })
        const item = await screen.findByTestId('item-0')
        await vi.advanceTimersByTimeAsync(1000)

        dispatchMousePointer(item, 'pointerdown', {
            clientX: 10,
            clientY: 10,
            pointerId: 22
        })
        dispatchMousePointer(window, 'pointermove', {
            clientX: 40,
            clientY: 30,
            pointerId: 22
        })
        await flushFrame()

        const visualElement = visualElementStore.get(item)
        expect(visualElement?.getValue('x')?.get()).toBe(30)
        expect(visualElement?.getValue('y')?.get() ?? 0).toBe(0)

        await result.rerender({ axis: 'xy', values: [0, 1, 2] })
        await vi.advanceTimersByTimeAsync(0)

        dispatchMousePointer(window, 'pointermove', {
            clientX: 60,
            clientY: 60,
            pointerId: 22
        })
        await flushFrame()
        // The drag controller's live state (Motion has no drag-active DOM marker).
        expect(elementDragControls.get(visualElement!)?.isDragging).toBe(true)
        expect(visualElement?.getValue('x')?.get()).toBe(50)
        expect(visualElement?.getValue('y')?.get()).toBe(50)

        dispatchMousePointer(window, 'pointercancel', {
            clientX: 60,
            clientY: 60,
            pointerId: 22
        })
        await flushFrame()
    })

    it('does not re-propose a swap until values change', async () => {
        const onReorder = vi.fn()
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            if (!this.dataset.testid?.startsWith('item-')) return new DOMRect()
            const index = Array.from(this.parentElement?.children ?? []).indexOf(this)
            return new DOMRect(index * 100, 0, 100, 100)
        })

        const result = render(ReorderHarness, {
            props: { axis: 'x', values: [0, 1, 2], onReorder }
        })
        const item = await screen.findByTestId('item-0')
        await vi.advanceTimersByTimeAsync(1000)

        dispatchMousePointer(item, 'pointerdown', {
            clientX: 10,
            clientY: 10,
            pointerId: 23
        })
        dispatchMousePointer(window, 'pointermove', {
            clientX: 70,
            clientY: 10,
            pointerId: 23
        })
        await flushFrame()
        expect(onReorder).toHaveBeenCalledOnce()
        expect(onReorder).toHaveBeenLastCalledWith([1, 0, 2], 0)

        // `values` hasn't changed (pending or rejected): the same swap must
        // not be proposed again (Motion 13.4.5 `Reorder/Group.tsx`).
        dispatchMousePointer(window, 'pointermove', {
            clientX: 71,
            clientY: 10,
            pointerId: 23
        })
        await flushFrame(16)
        expect(onReorder).toHaveBeenCalledOnce()

        dispatchMousePointer(window, 'pointermove', {
            clientX: 72,
            clientY: 10,
            pointerId: 23
        })
        await flushFrame(32)
        expect(onReorder).toHaveBeenCalledOnce()

        await result.rerender({ values: [1, 0, 2] })
        await vi.advanceTimersByTimeAsync(0)

        dispatchMousePointer(window, 'pointermove', {
            clientX: 170,
            clientY: 10,
            pointerId: 23
        })
        await flushFrame()
        expect(onReorder).toHaveBeenCalledTimes(2)
        expect(onReorder.mock.lastCall?.[0]).not.toEqual([1, 0, 2])

        dispatchMousePointer(window, 'pointercancel', {
            clientX: 170,
            clientY: 10,
            pointerId: 23
        })
        await flushFrame()
    })

    it('passes the moved item as the second argument to onReorder', async () => {
        const onReorder = vi.fn()
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            if (!this.dataset.testid?.startsWith('item-')) return new DOMRect()
            const index = Array.from(this.parentElement?.children ?? []).indexOf(this)
            return new DOMRect(index * 100, 0, 100, 100)
        })

        render(ReorderHarness, {
            props: { axis: 'x', values: [0, 1, 2], onReorder }
        })
        const item = await screen.findByTestId('item-2')
        await vi.advanceTimersByTimeAsync(1000)

        // Drag item 2 left past item 1's midpoint (Motion 14.6.0
        // `Reorder/Group.tsx` `onReorder(newOrder, moved)`).
        dispatchMousePointer(item, 'pointerdown', {
            clientX: 210,
            clientY: 10,
            pointerId: 24
        })
        dispatchMousePointer(window, 'pointermove', {
            clientX: 150,
            clientY: 10,
            pointerId: 24
        })
        await flushFrame()
        expect(onReorder.mock.lastCall).toEqual([[0, 2, 1], 2])

        dispatchMousePointer(window, 'pointercancel', {
            clientX: 150,
            clientY: 10,
            pointerId: 24
        })
        await flushFrame()
    })

    it('accepts axis="xy" and enables two-axis dragging', async () => {
        render(ReorderHarness, { props: { axis: 'xy' } })
        const item = await screen.findByTestId('item-0')
        await vi.advanceTimersByTimeAsync(1000)

        dispatchMousePointer(item, 'pointerdown', { clientX: 10, clientY: 10, pointerId: 2 })
        dispatchMousePointer(window, 'pointermove', {
            clientX: 40,
            clientY: 30,
            pointerId: 2
        })
        await flushFrame()

        const visualElement = visualElementStore.get(item)
        expect(visualElement?.getValue('x')?.get()).toBe(30)
        expect(visualElement?.getValue('y')?.get()).toBe(20)

        dispatchMousePointer(window, 'pointercancel', {
            clientX: 40,
            clientY: 30,
            pointerId: 2
        })
        await flushFrame()
    })

    it.each(['x', 'y'] as const)(
        'does not auto-scroll document axes from page-space drag points away from viewport edges (%s)',
        async (axis) => {
            const scrollPosition = { x: 1200, y: 900 }
            const initialScrollPosition = { ...scrollPosition }
            const pageOffset = { ...scrollPosition }
            const viewportCenter = {
                x: Math.round(window.innerWidth / 2),
                y: Math.round(window.innerHeight / 2)
            }

            vi.spyOn(window, 'scrollX', 'get').mockImplementation(() => scrollPosition.x)
            vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollPosition.y)
            vi.spyOn(document.body, 'scrollWidth', 'get').mockReturnValue(window.innerWidth + 5000)
            vi.spyOn(document.body, 'scrollHeight', 'get').mockReturnValue(
                window.innerHeight + 5000
            )
            vi.spyOn(document.body, 'getBoundingClientRect').mockReturnValue(
                new DOMRect(0, 0, window.innerWidth, window.innerHeight)
            )
            vi.spyOn(window, 'scrollBy').mockImplementation(((options: ScrollToOptions) => {
                scrollPosition.x += options.left ?? 0
                scrollPosition.y += options.top ?? 0
            }) as typeof window.scrollBy)

            const onDrag = vi.fn()
            render(ReorderHarness, { props: { axis, onDrag } })
            const item = await screen.findByTestId('item-0')
            await vi.advanceTimersByTimeAsync(1000)

            const pointerId = axis === 'x' ? 24 : 25
            const pointFor = (axisPosition: number) => {
                const clientX = axis === 'x' ? axisPosition : viewportCenter.x
                const clientY = axis === 'y' ? axisPosition : viewportCenter.y
                return {
                    clientX,
                    clientY,
                    pageX: clientX + pageOffset.x,
                    pageY: clientY + pageOffset.y,
                    pointerId
                }
            }
            const axisCenter = viewportCenter[axis]

            dispatchMousePointer(item, 'pointerdown', pointFor(axisCenter - 20))
            dispatchMousePointer(window, 'pointermove', pointFor(axisCenter - 10))
            await flushFrame()
            const finalPoint = pointFor(axisCenter)
            dispatchMousePointer(window, 'pointermove', finalPoint)
            await flushFrame(16)

            expect(onDrag).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    clientX: finalPoint.clientX,
                    clientY: finalPoint.clientY
                }),
                expect.objectContaining({
                    point: { x: finalPoint.pageX, y: finalPoint.pageY }
                })
            )
            expect({ x: window.scrollX, y: window.scrollY }).toEqual(initialScrollPosition)

            dispatchMousePointer(window, 'pointercancel', finalPoint)
            await flushFrame()
        }
    )

    it('rebases an active drag when a keyed reorder moves its layout slot', async () => {
        const onReorder = vi.fn()
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            if (!this.dataset.testid?.startsWith('item-')) return new DOMRect()

            const index = Array.from(this.parentElement?.children ?? []).indexOf(this)
            return new DOMRect(300 - index * 100, 0, 100, 100)
        })

        const result = render(ReorderHarness, {
            props: {
                axis: 'x',
                values: [0, 1, 2],
                groupStyle: 'direction: rtl',
                onReorder
            }
        })
        const item = await screen.findByTestId('item-0')
        await vi.advanceTimersByTimeAsync(1000)

        dispatchMousePointer(item, 'pointerdown', {
            clientX: 500,
            clientY: 10,
            pointerId: 3
        })
        dispatchMousePointer(window, 'pointermove', {
            clientX: 430,
            clientY: 10,
            pointerId: 3
        })
        await flushFrame()

        const visualElement = visualElementStore.get(item)
        expect(elementDragControls.get(visualElement!)?.isDragging).toBe(true)
        expect(visualElement?.getValue('x')?.get()).toBe(-70)

        await result.rerender({
            axis: 'x',
            values: [1, 0, 2],
            groupStyle: 'direction: rtl',
            onReorder
        })
        await vi.advanceTimersByTimeAsync(1000)
        onReorder.mockClear()

        // The keyed DOM move shifts item 0's slot 100px left. Motion's drag
        // controller adds the projection `didUpdate` delta (previous - next,
        // +100) to both the live value and the gesture origin, keeping a
        // stationary pointer pinned at +30 (motion-dom
        // `gestures/drag/VisualElementDragControls.ts:768-786` @ v14.5.0).
        expect(visualElement?.getValue('x')?.get()).toBe(30)
        dispatchMousePointer(window, 'pointermove', {
            clientX: 430,
            clientY: 10,
            pointerId: 3
        })
        await flushFrame()
        expect(visualElement?.getValue('x')?.get()).toBe(30)

        // Continue the same gesture toward item 2. From the compensated slot,
        // its ordinary midpoint threshold is x=-50: stop just before it, then
        // cross by 2px. A second Group-level compensation would add the 100px
        // slot delta again and incorrectly require another full slot of travel.
        dispatchMousePointer(window, 'pointermove', {
            clientX: 351,
            clientY: 10,
            pointerId: 3
        })
        await flushFrame()
        expect(visualElement?.getValue('x')?.get()).toBe(-49)
        expect(onReorder).not.toHaveBeenCalled()

        dispatchMousePointer(window, 'pointermove', {
            clientX: 349,
            clientY: 10,
            pointerId: 3
        })
        await flushFrame()
        expect(visualElement?.getValue('x')?.get()).toBe(-51)
        expect(onReorder).toHaveBeenCalledOnce()
        expect(onReorder).toHaveBeenCalledWith([1, 2, 0], 0)

        dispatchMousePointer(window, 'pointercancel', {
            clientX: 430,
            clientY: 10,
            pointerId: 3
        })
        await flushFrame()
    })

    it('projects each newly displaced sibling across sequential keyed reorders', async () => {
        const projectionCommit = vi.spyOn(
            MotionDomProjectionAdapter.prototype,
            'commitObservedLayoutChange'
        )
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            if (!this.dataset.testid?.startsWith('item-')) return new DOMRect()

            const index = Array.from(this.parentElement?.children ?? []).indexOf(this)
            return new DOMRect(300 - index * 100, 0, 100, 100)
        })

        const result = render(ReorderHarness, {
            props: {
                axis: 'x',
                values: [0, 1, 2],
                groupStyle: 'direction: rtl'
            }
        })
        await screen.findByTestId('item-0')
        await vi.advanceTimersByTimeAsync(1000)
        projectionCommit.mockClear()

        // First keyed move displaces item 1 from x=200 into item 0's x=300 slot.
        await result.rerender({
            axis: 'x',
            values: [1, 0, 2],
            groupStyle: 'direction: rtl'
        })
        await vi.advanceTimersByTimeAsync(1000)
        expect(projectionCommit).toHaveBeenCalledWith({
            left: 200,
            top: 0,
            width: 100,
            height: 100
        })
        projectionCommit.mockClear()

        // A distinct second move in the same mounted session displaces item 2.
        // Its old x=100 slot must survive the observer effect restart and seed
        // a new projection animation against its new x=200 layout.
        await result.rerender({
            axis: 'x',
            values: [1, 2, 0],
            groupStyle: 'direction: rtl'
        })
        await vi.advanceTimersByTimeAsync(1000)
        expect(projectionCommit).toHaveBeenCalledWith({
            left: 100,
            top: 0,
            width: 100,
            height: 100
        })
    })

    it('suppresses keyed-restart projection while the item is size-animating', async () => {
        const projectionCommit = vi.spyOn(
            MotionDomProjectionAdapter.prototype,
            'commitObservedLayoutChange'
        )
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            if (!this.dataset.testid?.startsWith('item-')) return new DOMRect()
            const index = Array.from(this.parentElement?.children ?? []).indexOf(this)
            return new DOMRect(index * 100, 0, 100, 100)
        })

        const result = render(ReorderHarness, {
            props: {
                axis: 'x',
                values: [0, 1, 2],
                itemSizeAnimation: true
            }
        })
        await screen.findByTestId('item-0')
        await vi.advanceTimersByTimeAsync(1000)
        projectionCommit.mockClear()

        await result.rerender({
            axis: 'x',
            values: [1, 0, 2],
            itemSizeAnimation: true
        })
        await vi.advanceTimersByTimeAsync(1000)

        expect(projectionCommit).not.toHaveBeenCalled()
    })

    it('respects the `as` prop on both group and item', async () => {
        render(ReorderHarness, { props: { as: 'article', itemAs: 'section' } })
        const group = await screen.findByTestId('group')
        expect(group.tagName).toBe('ARTICLE')
        expect(group.querySelectorAll('section')).toHaveLength(3)
    })

    it('disables scroll anchoring on the group', async () => {
        render(ReorderHarness)
        const group = await screen.findByTestId('group')
        expect(group.style.overflowAnchor).toBe('none')
    })

    it('keeps scroll anchoring disabled when a string style is passed', async () => {
        render(ReorderHarness, { props: { groupStyle: 'background: red' } })
        const group = await screen.findByTestId('group')
        expect(group.style.overflowAnchor).toBe('none')
        expect(group.style.background).toBe('red')
    })

    it('positions items relatively by default so the drag zIndex applies', async () => {
        render(ReorderHarness)
        const item = await screen.findByTestId('item-0')
        // z-index is ignored on static elements; without this default an
        // upward drag paints the dragged item UNDER the sibling it displaces.
        expect(item.style.position).toBe('relative')
        expect(item.style.zIndex).toBe('unset')
    })

    it('throws when an Item renders outside a Group', () => {
        expect(() => render(ItemOutsideGroup)).toThrow(
            'Reorder.Item must be a child of Reorder.Group'
        )
    })
})

/**
 * Port of upstream's "Reorder click after drag" cases
 * (`Reorder/__tests__/index.test.tsx` @ v14.2.0, Motion 14.1.1 #2682).
 * jsdom has no layout, so item slots come from a mocked
 * `getBoundingClientRect`: 100x50 rows stacked by DOM index.
 */
describe('Reorder click after drag', () => {
    let nextPointerId = 100

    const setup = async () => {
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            const id = this.dataset.testid
            if (id !== 'a' && id !== 'b') return new DOMRect()
            const index = Array.from(this.parentElement?.children ?? []).indexOf(this)
            return new DOMRect(0, index * 50, 100, 50)
        })

        const handlers = {
            onReorder: vi.fn(),
            onGroupClick: vi.fn(),
            onItemClick: vi.fn(),
            onChildClick: vi.fn()
        }
        render(ClickAfterDragHarness, { props: handlers })
        await screen.findByTestId('a')
        await vi.advanceTimersByTimeAsync(1000)
        return handlers
    }

    /** Press `trigger` (default: the item), move by (dx, dy), release. */
    const dragBy = async (element: HTMLElement, dx: number, dy: number, trigger = element) => {
        const pointerId = nextPointerId++
        dispatchMousePointer(trigger, 'pointerdown', {
            clientX: 50,
            clientY: 25,
            pointerId,
            bubbles: true
        })
        dispatchMousePointer(window, 'pointermove', {
            clientX: 50 + dx,
            clientY: 25 + dy,
            pointerId
        })
        await flushFrame()
        dispatchMousePointer(window, 'pointerup', {
            clientX: 50 + dx,
            clientY: 25 + dy,
            pointerId
        })
    }

    /** A pointer-generated click, which browsers fire straight after pointerup. */
    const click = (element: HTMLElement) => {
        element.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })
        )
    }

    it.each(['a', 'a-child', 'group'])(
        "doesn't click %s on the release that ends a reordering drag",
        async (target) => {
            const { onReorder, ...clicks } = await setup()

            // Press where the click will land, so it's a child of the press
            const item = screen.getByTestId('a')
            const trigger = target === 'group' ? item : screen.getByTestId(target)
            await dragBy(item, 0, 100, trigger)
            expect(onReorder).toHaveBeenCalledWith(['b', 'a'])

            click(screen.getByTestId(target))
            expect(clicks.onItemClick).not.toHaveBeenCalled()
            expect(clicks.onChildClick).not.toHaveBeenCalled()
            expect(clicks.onGroupClick).not.toHaveBeenCalled()
        }
    )

    it("clicks after a drag that doesn't reorder", async () => {
        const { onReorder, onItemClick, onGroupClick } = await setup()

        await dragBy(screen.getByTestId('a'), 100, 0)
        expect(onReorder).not.toHaveBeenCalled()

        click(screen.getByTestId('a'))
        expect(onItemClick).toHaveBeenCalledOnce()
        expect(onGroupClick).toHaveBeenCalledOnce()
    })

    it('clicks as normal once the drag has ended', async () => {
        const { onReorder, onItemClick } = await setup()

        await dragBy(screen.getByTestId('a'), 0, 100)
        expect(onReorder).toHaveBeenCalledOnce()
        // onDragEnd runs a frame after release and clears the guard
        await flushFrame(32)

        click(screen.getByTestId('a'))
        expect(onItemClick).toHaveBeenCalledOnce()
    })

    it('clicks as normal on the next press', async () => {
        const { onReorder, onItemClick } = await setup()

        await dragBy(screen.getByTestId('a'), 0, 100)
        expect(onReorder).toHaveBeenCalledOnce()

        const b = screen.getByTestId('b')
        const pointerId = nextPointerId++
        dispatchMousePointer(b, 'pointerdown', { clientX: 50, clientY: 25, pointerId })
        dispatchMousePointer(window, 'pointerup', { clientX: 50, clientY: 25, pointerId })

        click(b)
        expect(onItemClick).toHaveBeenCalledOnce()
    })

    it('fires clicks with no pointer press behind them', async () => {
        const { onReorder, onChildClick } = await setup()

        await dragBy(screen.getByTestId('a'), 0, 100)
        expect(onReorder).toHaveBeenCalledOnce()

        // e.g. Enter on a focused button
        screen.getByTestId('a-child').click()
        expect(onChildClick).toHaveBeenCalledOnce()
    })
})
