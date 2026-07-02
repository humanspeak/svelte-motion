import { render, screen } from '@testing-library/svelte'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import ItemOutsideGroup from './__tests__/ItemOutsideGroup.svelte'
import ReorderHarness from './__tests__/ReorderHarness.svelte'

// jsdom has no ResizeObserver; the items' `layout` prop observes one.
class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

beforeAll(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver as unknown as typeof ResizeObserver)
})

afterAll(() => {
    vi.unstubAllGlobals()
})

describe('Reorder.Group / Reorder.Item', () => {
    it('renders a ul with li items by default', async () => {
        render(ReorderHarness)
        const group = await screen.findByTestId('group')
        expect(group.tagName).toBe('UL')
        expect(group.querySelectorAll('li')).toHaveLength(3)
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
