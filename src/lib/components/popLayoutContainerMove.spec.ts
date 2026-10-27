import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PopLayoutMoveHarness from './__tests__/PopLayoutMoveHarness.svelte'

// Same set-up as `__tests__/onExitCompleteTiming.svelte.spec.ts`.
vi.mock('motion', () => ({
    animate: vi.fn(() => ({ finished: Promise.resolve() }))
}))

const getPopRule = (root: ParentNode = document.head) => {
    for (const style of Array.from(root.querySelectorAll('style'))) {
        for (const rule of Array.from(style.sheet?.cssRules ?? [])) {
            if (rule.cssText.includes('data-motion-pop-id')) {
                return (rule as CSSStyleRule).style
            }
        }
    }
}

/** Let the flush, then the microtask frameloop, run. */
const drain = async () => {
    await Promise.resolve()
    await Promise.resolve()
    await tick()
}

/**
 * Regression test for #2348. Port of upstream
 * `AnimatePresence/__tests__/pop-child-container-move.test.tsx` @ v14.7.1.
 *
 * The owned popLayout path pins the popped element to its offsetParent's
 * edges. If popping the element out of the layout moves the offsetParent (a
 * bottom-anchored or centred container shrinking around its remaining
 * children), the element moved with it. jsdom has no layout, so the move is
 * mocked: once popped, the element is laid out `drop` pixels lower than before.
 */
describe('AnimatePresence popLayout when popping moves the container', () => {
    // `HTMLElement.prototype` doesn't own it: the overrides below shadow
    // `Element.prototype`'s, and `afterEach` drops them again.
    const mockRects = (rect: (element: HTMLElement) => DOMRect) => {
        HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
            return rect(this)
        }
    }

    beforeEach(() => {
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        )
    })

    afterEach(() => {
        delete (HTMLElement.prototype as Partial<HTMLElement>).getBoundingClientRect
        document.head.querySelectorAll('style').forEach((style) => style.remove())
    })

    async function popWithDrop(drop: number, anchorY?: 'top' | 'bottom') {
        mockRects((element) => {
            const top =
                element.dataset?.testid === 'item'
                    ? 100 + (element.dataset.motionPopId ? drop : 0)
                    : 0
            return { left: 20, top } as DOMRect
        })

        const { rerender, getByTestId, unmount } = render(PopLayoutMoveHarness, {
            props: { present: true, anchorY }
        })
        await drain()

        await rerender({ present: false, anchorY })
        await drain()

        expect(getByTestId('item').dataset.motionPopId).toBeDefined()
        const rule = getPopRule()!
        const values = {
            top: rule.getPropertyValue('top'),
            topPriority: rule.getPropertyPriority('top'),
            bottom: rule.getPropertyValue('bottom')
        }
        unmount()
        return values
    }

    it('offsets the popped element back to where it was', async () => {
        const rule = await popWithDrop(70)
        expect(rule.top).toBe('-70px')
        expect(rule.topPriority).toBe('important')
    })

    it('offsets a bottom-anchored popped element back to where it was', async () => {
        const rule = await popWithDrop(70, 'bottom')
        // offsetParent height (0) - height (50) - offsetTop (0) + 70
        expect(rule.bottom).toBe('20px')
    })

    it("leaves the popped element in place if the container didn't move", async () => {
        const rule = await popWithDrop(0)
        expect(rule.top).toBe('0px')
    })

    it('measures every popped element before correcting any', async () => {
        const log: string[] = []
        const deleteRule = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'deleteRule')!
            .value as (this: CSSStyleSheet, index: number) => void

        mockRects((element) => {
            if (element.dataset?.testid !== 'item') return { left: 0, top: 0 } as DOMRect
            log.push('read')
            return { left: 20, top: element.dataset.motionPopId ? 170 : 100 } as DOMRect
        })
        CSSStyleSheet.prototype.deleteRule = function (this: CSSStyleSheet, index: number) {
            log.push('write')
            return deleteRule.call(this, index)
        }

        try {
            const { rerender, unmount } = render(PopLayoutMoveHarness, {
                props: { present: true, count: 3 }
            })
            await drain()
            log.length = 0

            await rerender({ present: false, count: 3 })
            await drain()
            unmount()
        } finally {
            CSSStyleSheet.prototype.deleteRule = deleteRule
        }

        // Each popped element is measured before and after popping, then
        // all three are corrected: no write sits between two reads.
        expect(log).toEqual([...Array(6).fill('read'), ...Array(3).fill('write')])
    })

    it('appends the pop style to root when given', async () => {
        mockRects(() => ({ left: 0, top: 0 }) as DOMRect)
        const root = document.createElement('div')
        document.body.appendChild(root)

        try {
            const { rerender, unmount } = render(PopLayoutMoveHarness, {
                props: { present: true, root }
            })
            await drain()

            await rerender({ present: false, root })
            await drain()

            expect(root.querySelector('style')).not.toBeNull()
            expect(getPopRule(root)).toBeDefined()
            expect(getPopRule()).toBeUndefined()
            unmount()
        } finally {
            root.remove()
        }
    })
})
