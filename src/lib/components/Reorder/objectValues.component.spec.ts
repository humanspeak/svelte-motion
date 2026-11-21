import { render, screen } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import ObjectValuesHarness from './__tests__/ObjectValuesHarness.svelte'

/**
 * Object-valued Reorder lists updated immutably under a stable `{#each}` key
 * (`items = items.map((i) => (i.id === id ? { ...i } : i))`). The item
 * component survives but receives a new `value` object, and the group prunes
 * the old one. The item must re-register its element and measured slot under
 * the new object so it stays reachable with the arrow keys, keeps the tab
 * stop and can still be moved. Upstream re-registers on every render
 * (Motion 14.14.0 `Reorder/Item.tsx:141`).
 */

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

beforeEach(() => {
    // Items only join the group's order once measured: give each a slot.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement
    ) {
        if (this.tagName !== 'LI') return new DOMRect()
        const index = Array.from(this.parentElement?.children ?? []).indexOf(this)
        return new DOMRect(0, index * 50, 100, 40)
    })
})

afterEach(() => {
    vi.restoreAllMocks()
})

type Entry = { id: string; rev: number }

type HarnessProps = {
    values: Entry[]
    onReorder?: (next: Entry[], moved: Entry) => void
}

/** Render the list and let every item measure into the group's order. */
const mount = async (props: HarnessProps) => {
    const result = render(ObjectValuesHarness, { props })
    await vi.advanceTimersByTimeAsync(1000)
    return result
}

/** Rerender with new props and let effects and measurements settle. */
const update = async (result: Awaited<ReturnType<typeof mount>>, props: HarnessProps) => {
    await result.rerender(props)
    await vi.advanceTimersByTimeAsync(1000)
    flushSync()
}

const item = (id: string) => screen.getByTestId(id)

const focused = () => document.activeElement?.getAttribute('data-testid')

const tabIndexes = () =>
    Array.from(screen.getByTestId('group').querySelectorAll('li')).map((li) => li.tabIndex)

/**
 * Dispatch a keydown on `element` and flush Svelte's updates. Returns
 * whether the key was left to the browser (not prevented).
 */
const press = (element: Element, key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
    element.dispatchEvent(event)
    flushSync()
    return !event.defaultPrevented
}

describe('Reorder with replaced value objects', () => {
    let a: Entry
    let b: Entry
    let c: Entry

    beforeEach(() => {
        a = { id: 'a', rev: 0 }
        b = { id: 'b', rev: 0 }
        c = { id: 'c', rev: 0 }
    })

    it('arrow keys still reach a replaced item', async () => {
        const result = await mount({ values: [a, b, c] })
        const b2 = { ...b, rev: 1 }
        await update(result, { values: [a, b2, c] })

        item('a').focus()
        flushSync()
        press(item('a'), 'ArrowDown')
        expect(focused()).toBe('b')
    })

    it('a replaced first item stays the tab stop', async () => {
        const result = await mount({ values: [a, b, c] })
        expect(tabIndexes()).toEqual([0, -1, -1])

        await update(result, { values: [{ ...a, rev: 1 }, b, c] })
        expect(tabIndexes()).toEqual([0, -1, -1])
    })

    it('a replaced item can be grabbed and moved, and reports the new object', async () => {
        const onReorder = vi.fn()
        const result = await mount({ values: [a, b, c], onReorder })
        const b2 = { ...b, rev: 1 }
        await update(result, { values: [a, b2, c], onReorder })

        press(item('b'), ' ')
        press(item('b'), 'ArrowDown')
        const [next, moved] = onReorder.mock.lastCall!
        expect(next.map((e: Entry) => e.id)).toEqual(['a', 'c', 'b'])
        expect(next[2]).toBe(b2)
        expect(moved).toBe(b2)
    })
})
