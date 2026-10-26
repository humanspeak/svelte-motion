import { render, screen } from '@testing-library/svelte'
import { visualElementStore } from 'motion-dom'
import { flushSync } from 'svelte'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import KeyboardHarness from './__tests__/KeyboardHarness.svelte'

/**
 * Keyboard reordering (Motion 14.6.0, #2658). Port of upstream
 * `Reorder/__tests__/keyboard.test.tsx`, plus Svelte-specific cases for
 * in-place `$state` mutation and move-blurs. Focus surviving a real DOM move
 * is covered by `e2e/reorder/keyboard.spec.ts` (jsdom doesn't blur moved
 * nodes).
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

type HarnessProps = {
    values?: string[]
    axis?: 'x' | 'y' | 'xy'
    dir?: 'rtl'
    apply?: 'replace' | 'splice' | 'none'
    rendered?: string[]
    onReorder?: (next: string[], moved: string) => void
    itemProps?: Record<string, unknown>
}

/** Render the list and let every item measure into the group's order. */
const mount = async (props: HarnessProps = {}) => {
    const result = render(KeyboardHarness, { props })
    await vi.advanceTimersByTimeAsync(1000)
    return result
}

const item = (id: string) => screen.getByTestId(id)

const order = () =>
    Array.from(screen.getByTestId('group').querySelectorAll('li')).map((li) =>
        li.getAttribute('data-testid')
    )

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

/** A grabbed item has its whileDrag state active. */
const isGrabbed = (element: Element) =>
    !!visualElementStore.get(element)?.animationState?.getState().whileDrag.isActive

describe('Reorder keyboard', () => {
    it('makes items focusable', async () => {
        await mount()
        expect(item('a').tabIndex).toBe(0)
        expect(item('a').getAttribute('tabindex')).toBe('0')
    })

    it('lets items override tabindex', async () => {
        await mount({ itemProps: { tabindex: -1 } })
        expect(item('a').tabIndex).toBe(-1)
    })

    it('leaves arrows to the browser until an item is grabbed', async () => {
        const onReorder = vi.fn()
        await mount({ onReorder })

        expect(press(item('a'), 'ArrowDown')).toBe(true)
        expect(press(item('b'), 'ArrowUp')).toBe(true)
        expect(onReorder).not.toHaveBeenCalled()
    })

    it('grabs with Space, moves with arrows and drops with Space', async () => {
        const onReorder = vi.fn()
        await mount({ onReorder })
        const a = item('a')

        expect(isGrabbed(a)).toBe(false)
        expect(press(a, ' ')).toBe(false)
        expect(isGrabbed(a)).toBe(true)
        expect(onReorder).not.toHaveBeenCalled()

        expect(press(a, 'ArrowDown')).toBe(false)
        expect(onReorder).toHaveBeenLastCalledWith(['b', 'a', 'c'], 'a')
        expect(order()).toEqual(['b', 'a', 'c'])
        expect(isGrabbed(a)).toBe(true)

        press(a, 'ArrowDown')
        expect(order()).toEqual(['b', 'c', 'a'])

        press(a, 'ArrowUp')
        expect(order()).toEqual(['b', 'a', 'c'])

        expect(press(a, ' ')).toBe(false)
        expect(isGrabbed(a)).toBe(false)
        expect(order()).toEqual(['b', 'a', 'c'])

        // Dropped: arrows are the browser's again
        expect(press(a, 'ArrowDown')).toBe(true)
        expect(order()).toEqual(['b', 'a', 'c'])
        expect(onReorder).toHaveBeenCalledTimes(3)
    })

    it('passes the moved item as the second argument to onReorder', async () => {
        const onReorder = vi.fn()
        await mount({ onReorder })

        press(item('b'), ' ')
        press(item('b'), 'ArrowUp')
        expect(onReorder).toHaveBeenLastCalledWith(['b', 'a', 'c'], 'b')
    })

    it('leaves Enter alone so it keeps its tap meaning', async () => {
        const onReorder = vi.fn()
        await mount({ onReorder })
        const b = item('b')

        expect(press(b, 'Enter')).toBe(true)
        expect(isGrabbed(b)).toBe(false)
        press(b, 'ArrowUp')
        expect(onReorder).not.toHaveBeenCalled()
    })

    it('ignores a held Space', async () => {
        await mount()
        const a = item('a')

        press(a, ' ')
        press(a, ' ', { repeat: true })
        expect(isGrabbed(a)).toBe(true)
    })

    it('cancels with Escape, restoring the order from the grab', async () => {
        const onReorder = vi.fn()
        await mount({ onReorder })
        const a = item('a')

        press(a, ' ')
        press(a, 'ArrowDown')
        press(a, 'ArrowDown')
        expect(order()).toEqual(['b', 'c', 'a'])

        expect(press(a, 'Escape')).toBe(false)
        expect(onReorder).toHaveBeenLastCalledWith(['a', 'b', 'c'], 'a')
        expect(order()).toEqual(['a', 'b', 'c'])
        expect(isGrabbed(a)).toBe(false)

        expect(press(a, 'ArrowDown')).toBe(true)
        expect(order()).toEqual(['a', 'b', 'c'])
    })

    it('restores the order from the latest grab', async () => {
        await mount()
        const a = item('a')

        press(a, ' ')
        press(a, 'ArrowDown')
        press(a, ' ')
        press(a, ' ')
        press(a, 'ArrowDown')
        expect(order()).toEqual(['b', 'c', 'a'])

        press(a, 'Escape')
        expect(order()).toEqual(['b', 'a', 'c'])
    })

    it("cancelling without a move doesn't reorder", async () => {
        const onReorder = vi.fn()
        await mount({ onReorder })
        const a = item('a')

        press(a, ' ')
        expect(press(a, 'Escape')).toBe(false)
        expect(isGrabbed(a)).toBe(false)
        expect(onReorder).not.toHaveBeenCalled()
    })

    it('leaves Escape to the browser when nothing is grabbed', async () => {
        await mount()
        expect(press(item('a'), 'Escape')).toBe(true)
    })

    it('drops, keeping the order, when focus leaves the item', async () => {
        const onReorder = vi.fn()
        await mount({ onReorder })
        const a = item('a')

        a.focus()
        press(a, ' ')
        press(a, 'ArrowDown')
        expect(document.activeElement).toBe(a)
        expect(isGrabbed(a)).toBe(true)

        item('c').focus()
        flushSync()
        expect(isGrabbed(a)).toBe(false)
        expect(order()).toEqual(['b', 'a', 'c'])

        a.focus()
        expect(press(a, 'ArrowDown')).toBe(true)
        expect(order()).toEqual(['b', 'a', 'c'])
        expect(onReorder).toHaveBeenCalledTimes(1)
    })

    it('ignores arrows across the axis and other keys while grabbed', async () => {
        const onReorder = vi.fn()
        await mount({ onReorder })
        const b = item('b')

        press(b, ' ')
        for (const key of ['ArrowLeft', 'ArrowRight', 'Tab', 'a']) {
            expect(press(b, key)).toBe(true)
        }
        expect(onReorder).not.toHaveBeenCalled()
        expect(isGrabbed(b)).toBe(true)
    })

    it('ignores keys with Alt, Ctrl or Meta held', async () => {
        const onReorder = vi.fn()
        await mount({ onReorder })
        const a = item('a')

        for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
            expect(press(a, ' ', { [modifier]: true })).toBe(true)
        }
        expect(isGrabbed(a)).toBe(false)

        press(a, ' ')
        for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
            expect(press(a, 'ArrowDown', { [modifier]: true })).toBe(true)
            expect(press(a, 'Escape', { [modifier]: true })).toBe(true)
        }
        expect(onReorder).not.toHaveBeenCalled()
        expect(isGrabbed(a)).toBe(true)

        press(a, 'ArrowDown')
        expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c'], 'a')
    })

    it('does nothing past either end', async () => {
        const onReorder = vi.fn()
        await mount({ onReorder })

        press(item('a'), ' ')
        expect(press(item('a'), 'ArrowUp')).toBe(false)
        press(item('c'), ' ')
        expect(press(item('c'), 'ArrowDown')).toBe(false)
        expect(onReorder).not.toHaveBeenCalled()
    })

    it('moves with left and right on the x axis', async () => {
        await mount({ axis: 'x' })
        const a = item('a')

        press(a, ' ')
        press(a, 'ArrowRight')
        expect(order()).toEqual(['b', 'a', 'c'])

        expect(press(a, 'ArrowDown')).toBe(true)
        expect(order()).toEqual(['b', 'a', 'c'])

        press(a, 'ArrowLeft')
        expect(order()).toEqual(['a', 'b', 'c'])
    })

    it('flips left and right in RTL', async () => {
        await mount({ axis: 'x', dir: 'rtl' })

        press(item('a'), ' ')
        press(item('a'), 'ArrowLeft')
        expect(order()).toEqual(['b', 'a', 'c'])
    })

    it('accepts every arrow on the xy axis', async () => {
        await mount({ axis: 'xy' })
        const a = item('a')

        press(a, ' ')
        press(a, 'ArrowRight')
        expect(order()).toEqual(['b', 'a', 'c'])
        press(a, 'ArrowDown')
        expect(order()).toEqual(['b', 'c', 'a'])
        press(a, 'ArrowUp')
        expect(order()).toEqual(['b', 'a', 'c'])
        press(a, 'ArrowLeft')
        expect(order()).toEqual(['a', 'b', 'c'])
    })

    it('ignores keys from inside the item', async () => {
        const onReorder = vi.fn()
        await mount({ onReorder })
        const input = item('a-input')

        expect(press(input, ' ')).toBe(true)
        expect(press(input, 'Enter')).toBe(true)
        expect(isGrabbed(item('a'))).toBe(false)

        press(item('a'), ' ')
        expect(press(input, 'ArrowDown')).toBe(true)
        expect(press(input, 'Escape')).toBe(true)
        expect(onReorder).not.toHaveBeenCalled()
        expect(isGrabbed(item('a'))).toBe(true)
    })

    it("lets the item's onkeydown prevent grabbing and moving", async () => {
        const onReorder = vi.fn()
        let prevent = true
        const onkeydown = vi.fn((event: KeyboardEvent) => {
            if (prevent) event.preventDefault()
        })
        await mount({ onReorder, itemProps: { onkeydown } })
        const a = item('a')

        press(a, ' ')
        expect(onkeydown).toHaveBeenCalledTimes(1)
        expect(isGrabbed(a)).toBe(false)

        prevent = false
        press(a, ' ')
        expect(isGrabbed(a)).toBe(true)

        prevent = true
        press(a, 'ArrowDown')
        press(a, 'Escape')
        expect(onReorder).not.toHaveBeenCalled()
        expect(isGrabbed(a)).toBe(true)
    })

    it('keeps focus and the grab on the moved item', async () => {
        await mount()
        const b = item('b')

        b.focus()
        press(b, ' ')
        press(b, 'ArrowUp')
        expect(document.activeElement).toBe(b)
        expect(isGrabbed(b)).toBe(true)

        press(b, 'ArrowDown')
        press(b, 'ArrowDown')
        expect(document.activeElement).toBe(b)
        expect(isGrabbed(b)).toBe(true)
    })

    it('skips and keeps unrendered values in place', async () => {
        const onReorder = vi.fn()
        const { rerender } = await mount({
            values: ['a', 'hidden', 'b'],
            rendered: ['a', 'b'],
            apply: 'none',
            onReorder
        })

        press(item('a'), ' ')
        press(item('a'), 'ArrowDown')
        // As with drag, "a" and "b" swap slots and "hidden" keeps its own
        expect(onReorder).toHaveBeenLastCalledWith(['b', 'hidden', 'a'], 'a')

        // The app has since moved "hidden" too: cancelling only restores
        // the rendered items, into the slots they now hold
        await rerender({ values: ['hidden', 'b', 'a'], rendered: ['b', 'a'] })
        press(item('a'), 'Escape')
        expect(onReorder).toHaveBeenLastCalledWith(['hidden', 'a', 'b'], 'a')
    })

    it('cancelling keeps values added since the grab in their slots', async () => {
        const onReorder = vi.fn()
        const { rerender } = await mount({ values: ['a', 'b', 'c'], apply: 'none', onReorder })

        press(item('b'), ' ')
        await rerender({ values: ['new', 'a', 'b', 'c', 'end'] })
        await vi.advanceTimersByTimeAsync(1000)
        press(item('b'), 'ArrowDown')
        expect(onReorder).toHaveBeenLastCalledWith(['new', 'a', 'c', 'b', 'end'], 'b')

        await rerender({ values: ['new', 'a', 'c', 'b', 'end'] })
        press(item('b'), 'Escape')
        expect(onReorder).toHaveBeenLastCalledWith(['new', 'a', 'b', 'c', 'end'], 'b')
    })

    it('applies whileDrag while grabbed', async () => {
        await mount({ values: ['a'], itemProps: { transition: { type: false } } })
        const a = item('a')
        const opacity = () => Number.parseFloat(a.style.opacity || '1')

        press(a, ' ')
        await vi.advanceTimersByTimeAsync(50)
        expect(opacity()).toBe(0.5)

        press(a, ' ')
        await vi.advanceTimersByTimeAsync(50)
        expect(opacity()).toBe(1)

        press(a, ' ')
        await vi.advanceTimersByTimeAsync(50)
        expect(opacity()).toBe(0.5)

        a.focus()
        a.blur()
        await vi.advanceTimersByTimeAsync(50)
        expect(opacity()).toBe(1)
    })

    it("doesn't fire drag callbacks for keyboard grabs", async () => {
        const onDragStart = vi.fn()
        const onDragEnd = vi.fn()
        await mount({ itemProps: { onDragStart, onDragEnd } })
        const a = item('a')

        press(a, ' ')
        press(a, 'ArrowDown')
        press(a, ' ')
        expect(onDragStart).not.toHaveBeenCalled()
        expect(onDragEnd).not.toHaveBeenCalled()
    })

    // Svelte-specific (not in upstream)

    it('restores the grab-time order on Escape when values is mutated in place', async () => {
        const onReorder = vi.fn()
        await mount({ apply: 'splice', onReorder })
        const b = item('b')

        press(b, ' ')
        press(b, 'ArrowDown')
        expect(order()).toEqual(['a', 'c', 'b'])

        press(b, 'Escape')
        expect(onReorder).toHaveBeenLastCalledWith(['a', 'b', 'c'], 'b')
        expect(order()).toEqual(['a', 'b', 'c'])
    })

    it("doesn't forward a move-blur to the item's onblur", async () => {
        const onblur = vi.fn()
        // `none`: the move stays pending, as with a deferred consumer.
        await mount({ apply: 'none', itemProps: { onblur } })
        const a = item('a')

        a.focus()
        press(a, ' ')
        press(a, 'ArrowDown')

        // The node moved and focus fell to <body>
        a.dispatchEvent(new FocusEvent('blur', { relatedTarget: null }))
        flushSync()
        expect(onblur).not.toHaveBeenCalled()
        expect(isGrabbed(a)).toBe(true)

        // A real blur still reaches the consumer and drops the grab
        press(a, 'Shift')
        a.dispatchEvent(new FocusEvent('blur', { relatedTarget: item('c') }))
        flushSync()
        expect(onblur).toHaveBeenCalledTimes(1)
        expect(isGrabbed(a)).toBe(false)
    })
})
