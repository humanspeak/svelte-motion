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

        const element = container.querySelector('[data-testid="test-element"]') as HTMLElement
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

        const element = container.querySelector('[data-testid="test-element"]') as HTMLElement
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

        const element = container.querySelector('[data-testid="list-item"]') as HTMLElement
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

        const element = container.querySelector('[data-testid="complex-element"]') as HTMLElement
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

        const element = container.querySelector('[data-testid="test-element"]') as HTMLElement
        expect(element).toBeTruthy()

        await vi.runAllTimersAsync()

        expect(element).toBeTruthy()
    })
})
