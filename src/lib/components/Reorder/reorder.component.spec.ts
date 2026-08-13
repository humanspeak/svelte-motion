import { MotionDomProjectionAdapter } from '$lib/utils/motionDomProjection'
import { render, screen } from '@testing-library/svelte'
import { visualElementStore } from 'motion-dom'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import DetectedAxisHarness from './__tests__/DetectedAxisHarness.svelte'
import ItemOutsideGroup from './__tests__/ItemOutsideGroup.svelte'
import ReorderHarness from './__tests__/ReorderHarness.svelte'

// jsdom has no ResizeObserver; the items' `layout` prop observes one.
class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

beforeAll(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterAll(() => {
    vi.unstubAllGlobals()
})

afterEach(() => {
    vi.restoreAllMocks()
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
        item.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 40, clientY: 30, pointerId: 1 })
        )

        const visualElement = visualElementStore.get(item)
        expect(visualElement?.getValue('x')?.get()).toBe(30)
        expect(visualElement?.getValue('y')?.get()).toBe(0)

        window.dispatchEvent(
            new PointerEvent('pointercancel', { clientX: 40, clientY: 30, pointerId: 1 })
        )
    })

    it('keeps the active pointer session alive when the group axis changes', async () => {
        const result = render(ReorderHarness, {
            props: { axis: 'x', values: [0, 1, 2] }
        })
        const item = await screen.findByTestId('item-0')
        await vi.advanceTimersByTimeAsync(1000)

        item.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 22 })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 40, clientY: 30, pointerId: 22 })
        )

        const visualElement = visualElementStore.get(item)
        expect(visualElement?.getValue('x')?.get()).toBe(30)
        expect(visualElement?.getValue('y')?.get() ?? 0).toBe(0)

        await result.rerender({ axis: 'xy', values: [0, 1, 2] })
        await vi.advanceTimersByTimeAsync(0)

        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 60, clientY: 60, pointerId: 22 })
        )
        expect(item.dataset.svelteMotionDragActive).toBe('true')
        expect(visualElement?.getValue('x')?.get()).toBe(50)
        expect(visualElement?.getValue('y')?.get()).toBe(50)

        window.dispatchEvent(
            new PointerEvent('pointercancel', { clientX: 60, clientY: 60, pointerId: 22 })
        )
    })

    it('continues proposing swaps when a controlled consumer rejects one', async () => {
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
        const item = await screen.findByTestId('item-0')
        await vi.advanceTimersByTimeAsync(1000)

        item.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 23 })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 70, clientY: 10, pointerId: 23 })
        )
        expect(onReorder).toHaveBeenCalledOnce()
        expect(onReorder).toHaveBeenLastCalledWith([1, 0, 2])

        await vi.advanceTimersByTimeAsync(20)
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 71, clientY: 10, pointerId: 23 })
        )
        expect(onReorder).toHaveBeenCalledTimes(2)

        window.dispatchEvent(
            new PointerEvent('pointercancel', { clientX: 71, clientY: 10, pointerId: 23 })
        )
    })

    it('accepts axis="xy" and enables two-axis dragging', async () => {
        render(ReorderHarness, { props: { axis: 'xy' } })
        const item = await screen.findByTestId('item-0')
        await vi.advanceTimersByTimeAsync(1000)

        item.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 2 })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 40, clientY: 30, pointerId: 2 })
        )

        const visualElement = visualElementStore.get(item)
        expect(visualElement?.getValue('x')?.get()).toBe(30)
        expect(visualElement?.getValue('y')?.get()).toBe(20)

        window.dispatchEvent(
            new PointerEvent('pointercancel', { clientX: 40, clientY: 30, pointerId: 2 })
        )
    })

    it('rebases an active drag when a keyed reorder moves its layout slot', async () => {
        const onReorder = vi.fn()
        const draggedCommit = vi.spyOn(
            MotionDomProjectionAdapter.prototype,
            'commitDraggedLayoutChange'
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
                groupStyle: 'direction: rtl',
                onReorder
            }
        })
        const item = await screen.findByTestId('item-0')
        await vi.advanceTimersByTimeAsync(1000)

        item.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: 500, clientY: 10, pointerId: 3 })
        )
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 430, clientY: 10, pointerId: 3 })
        )

        const visualElement = visualElementStore.get(item)
        expect(item.dataset.svelteMotionDragActive).toBe('true')
        expect(visualElement?.getValue('x')?.get()).toBe(-70)

        await result.rerender({
            axis: 'x',
            values: [1, 0, 2],
            groupStyle: 'direction: rtl',
            onReorder
        })
        await vi.advanceTimersByTimeAsync(1000)
        onReorder.mockClear()

        expect(draggedCommit).toHaveBeenCalledTimes(1)
        expect(draggedCommit).toHaveBeenCalledWith(
            { left: 300, top: 0, width: 100, height: 100 },
            expect.any(Function)
        )

        // The keyed DOM move shifts item 0's slot 100px left. Upstream drag
        // projection adds previous - next (+100) to both the live value and
        // gesture origin, keeping a stationary pointer pinned at +30.
        expect(visualElement?.getValue('x')?.get()).toBe(30)
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 430, clientY: 10, pointerId: 3 })
        )
        expect(visualElement?.getValue('x')?.get()).toBe(30)

        // Continue the same gesture toward item 2. From the compensated slot,
        // its ordinary midpoint threshold is x=-50: stop just before it, then
        // cross by 2px. A second Group-level compensation would add the 100px
        // slot delta again and incorrectly require another full slot of travel.
        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 351, clientY: 10, pointerId: 3 })
        )
        expect(visualElement?.getValue('x')?.get()).toBe(-49)
        expect(onReorder).not.toHaveBeenCalled()

        window.dispatchEvent(
            new PointerEvent('pointermove', { clientX: 349, clientY: 10, pointerId: 3 })
        )
        expect(visualElement?.getValue('x')?.get()).toBe(-51)
        expect(onReorder).toHaveBeenCalledOnce()
        expect(onReorder).toHaveBeenCalledWith([1, 2, 0])

        window.dispatchEvent(
            new PointerEvent('pointercancel', { clientX: 430, clientY: 10, pointerId: 3 })
        )
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
