import { motion } from '$lib'
import { render } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('motion component with initial={false}', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    it('should render element when initial={false}', async () => {
        const { container } = render(motion.div, {
            props: {
                initial: false,
                animate: { opacity: 1, scale: 1 },
                'data-testid': 'test-element'
            }
        })

        const element = container.querySelector<HTMLElement>('[data-testid="test-element"]')!
        expect(element).toBeTruthy()

        await vi.runAllTimersAsync()
    })

    it('should render element when initial has keyframes', async () => {
        const { container } = render(motion.div, {
            props: {
                initial: { opacity: 0, scale: 0 },
                animate: { opacity: 1, scale: 1 },
                transition: { duration: 0.5 },
                'data-testid': 'test-element'
            }
        })

        const element = container.querySelector<HTMLElement>('[data-testid="test-element"]')!
        expect(element).toBeTruthy()

        await vi.runAllTimersAsync()
    })

    it('should work with list items', async () => {
        const { container } = render(motion.li, {
            props: {
                initial: false,
                animate: { backgroundColor: '#eee' },
                transition: { duration: 0.2 },
                'data-testid': 'list-item'
            }
        })

        const element = container.querySelector<HTMLElement>('[data-testid="list-item"]')!
        expect(element).toBeTruthy()
        expect(element.tagName.toLowerCase()).toBe('li')

        await vi.runAllTimersAsync()

        expect(element).toBeTruthy()
    })

    it('should handle complex animations with initial={false}', async () => {
        const { container } = render(motion.div, {
            props: {
                initial: false,
                animate: {
                    opacity: 1,
                    scale: 1.2,
                    x: 100,
                    y: 50,
                    rotate: 45
                },
                transition: { duration: 0.3 },
                'data-testid': 'complex-element'
            }
        })

        const element = container.querySelector<HTMLElement>('[data-testid="complex-element"]')!
        expect(element).toBeTruthy()

        await vi.runAllTimersAsync()

        expect(element).toBeTruthy()
    })

    it('should render when initial={false} and no animate prop', async () => {
        const { container } = render(motion.div, {
            props: {
                initial: false,
                'data-testid': 'test-element'
            }
        })

        const element = container.querySelector<HTMLElement>('[data-testid="test-element"]')!
        expect(element).toBeTruthy()

        await vi.runAllTimersAsync()

        expect(element).toBeTruthy()
    })
})

describe('transform shortcut persists after animation (#377)', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    it('keeps a non-identity animate transform as inline style once settled (scaleX)', async () => {
        // Non-identity target on purpose: scaleX(1) is the identity transform,
        // which correctly serializes to `transform: none` (matching upstream
        // build-transform), so it can't distinguish "persisted" from "reverted".
        // scaleX(0.5) reverting to none WOULD be the bug.
        const { container } = render(motion.div, {
            props: {
                initial: { scaleX: 0 },
                animate: { scaleX: 0.5 },
                transition: { duration: 0.4 },
                'data-testid': 'persist-scalex'
            }
        })
        const el = container.querySelector<HTMLElement>('[data-testid="persist-scalex"]')!

        await vi.runAllTimersAsync()

        // The bug: inline transform ends up empty, so WAAPI completion leaves
        // transform:none. After the fix the resting target is the inline baseline.
        expect(el.style.transform).not.toBe('')
        expect(el.style.transform).toContain('scaleX(0.5)')
    })

    it('keeps a non-identity transform at rest (rotate)', async () => {
        const { container } = render(motion.div, {
            props: {
                initial: { rotate: 0 },
                animate: { rotate: 45 },
                transition: { duration: 0.4 },
                'data-testid': 'persist-rotate'
            }
        })
        const el = container.querySelector<HTMLElement>('[data-testid="persist-rotate"]')!

        await vi.runAllTimersAsync()

        expect(el.style.transform).toContain('rotate(45deg)')
    })

    it('rests at the LAST keyframe of an array target, not the first', async () => {
        const { container } = render(motion.div, {
            props: {
                initial: { x: 0 },
                animate: { x: [0, 100, 50] },
                transition: { duration: 0.4 },
                'data-testid': 'persist-array'
            }
        })
        const el = container.querySelector<HTMLElement>('[data-testid="persist-array"]')!

        await vi.runAllTimersAsync()

        expect(el.style.transform).toContain('translateX(50px)')
        expect(el.style.transform).not.toContain('translateX(0px)')
    })
})
