import { render } from '@testing-library/svelte'
import { arc, visualElementStore } from 'motion-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MotionContainer from './_MotionContainer.svelte'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Samples a VisualElement's latest values and inline transform over time.
 *
 * @param el - The rendered motion element.
 * @param count - Number of samples to collect.
 * @param stepMs - Milliseconds between samples.
 * @returns The collected animation values and transforms.
 */
const sample = async (el: HTMLElement, count: number, stepMs: number) => {
    const visualElement = visualElementStore.get(el)!
    const samples: Array<{
        x: unknown
        y: unknown
        pathRotation: unknown
        transform: string
    }> = []

    for (let i = 0; i < count; i++) {
        await sleep(stepMs)
        samples.push({
            x: visualElement.latestValues.x,
            y: visualElement.latestValues.y,
            pathRotation: visualElement.latestValues.pathRotation,
            transform: el.style.transform
        })
    }

    return samples
}

describe('_MotionContainer transition.path (arc)', () => {
    beforeEach(() => {
        // The shared Vitest setup installs fake timers; motion-dom's frame
        // loop needs real ones (see vitest-setup-client.ts).
        vi.useRealTimers()
        ;(globalThis as any).requestAnimationFrame = (callback: FrameRequestCallback) =>
            setTimeout(() => callback(performance.now()), 16) as unknown as number
        ;(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id)
    })

    it('curves x/y along the arc and composes pathRotation onto transform', async () => {
        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                initial: { x: 0, y: 0 },
                animate: { x: 200 },
                transition: {
                    duration: 1,
                    ease: 'linear',
                    path: arc({ strength: 1, rotate: true })
                }
            }
        })
        await sleep(100)
        const el = container.firstElementChild as HTMLElement
        const samples = await sample(el, 8, 120)

        const mid = samples.find(
            (entry) => typeof entry.x === 'number' && entry.x > 60 && entry.x < 140
        )
        expect(mid).toBeTruthy()
        expect(Math.abs(Number(mid!.y))).toBeGreaterThan(30)
        expect(mid!.transform).toMatch(/translateY\(/)
        expect(mid!.transform).toMatch(/rotate\(/)
        expect(typeof mid!.pathRotation).toBe('number')

        const last = samples.at(-1)!
        expect(last.x).toBe(200)
        expect(last.y).toBe(0)
        expect(last.transform).toBe('translateX(200px)')
    })

    it('rotate:false keeps transform free of rotate()', async () => {
        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                initial: { x: 0, y: 0 },
                animate: { x: 200 },
                transition: {
                    duration: 1,
                    ease: 'linear',
                    path: arc({ strength: 1 })
                }
            }
        })
        await sleep(100)
        const el = container.firstElementChild as HTMLElement
        const samples = await sample(el, 8, 120)

        expect(samples.some((entry) => entry.transform.includes('rotate('))).toBe(false)
        expect(samples.some((entry) => Math.abs(Number(entry.y)) > 30)).toBe(true)

        const last = samples.at(-1)!
        expect(last.x).toBe(200)
        expect(last.y).toBe(0)
        expect(last.transform).toBe('translateX(200px)')
    })

    it('keeps a user rotate in the transform while pathRotation is additive', async () => {
        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                initial: { x: 0, y: 0, rotate: 45 },
                animate: { x: 200 },
                transition: {
                    duration: 1,
                    ease: 'linear',
                    path: arc({ strength: 1, rotate: true })
                }
            }
        })
        await sleep(100)
        const el = container.firstElementChild as HTMLElement
        const samples = await sample(el, 8, 120)

        const mid = samples.find(
            (entry) => typeof entry.x === 'number' && entry.x > 60 && entry.x < 140
        )
        expect(mid).toBeTruthy()
        expect(mid!.transform).toMatch(/rotate\(45deg\) rotate\(/)
        expect(typeof mid!.pathRotation).toBe('number')

        const last = samples.at(-1)!
        expect(last.x).toBe(200)
        expect(last.y).toBe(0)
        expect(last.transform).toBe('translateX(200px) rotate(45deg)')
    })
})
