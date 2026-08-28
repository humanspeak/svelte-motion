import { sleep } from '$lib/utils/testing'
import { render } from '@testing-library/svelte'
import { visualElementStore } from 'motion-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SkipAnimationsHarness from './__tests__/SkipAnimationsHarness.svelte'

describe('MotionConfig.skipAnimations', () => {
    beforeEach(() => {
        // The shared Vitest setup installs fake timers; motion-dom's frame
        // loop needs real ones (see vitest-setup-client.ts).
        vi.useRealTimers()
        ;(globalThis as never as { requestAnimationFrame: unknown }).requestAnimationFrame = (
            callback: FrameRequestCallback
        ) => setTimeout(() => callback(performance.now()), 16) as unknown as number
        ;(globalThis as never as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (
            id: number
        ) => clearTimeout(id)
    })

    /** Render the harness, settle a few frames, and read the node's live `x`. */
    const renderAndReadX = async (skipAnimations: boolean | undefined): Promise<unknown> => {
        const { container } = render(SkipAnimationsHarness as unknown as any, {
            props: { skipAnimations }
        })
        await sleep(120)
        const el = container.querySelector('div') as HTMLElement
        return visualElementStore.get(el)!.latestValues.x
    }

    it('jumps straight to the final value instead of tweening', async () => {
        expect(await renderAndReadX(true)).toBe(200)
    })

    it('skipAnimations={false} still tweens', async () => {
        const x = Number(await renderAndReadX(false))
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThan(190)
    })

    it('no skipAnimations still tweens', async () => {
        const x = Number(await renderAndReadX(undefined))
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThan(190)
    })

    it('applies a changed config to the next animation without remounting', async () => {
        const { container, rerender } = render(SkipAnimationsHarness as unknown as any, {
            props: { skipAnimations: false, animateX: 200 }
        })
        await sleep(100)

        const el = container.querySelector('div') as HTMLElement
        const visualElement = visualElementStore.get(el)!
        const initialX = Number(visualElement.latestValues.x)
        expect(initialX).toBeGreaterThanOrEqual(0)
        expect(initialX).toBeLessThan(190)

        await rerender({ skipAnimations: true, animateX: 400 })
        await sleep(100)

        expect(container.querySelector('div')).toBe(el)
        expect(visualElement.latestValues.x).toBe(400)
    })

    describe('transition inheritance', () => {
        const renderTransition = (
            transition: Record<string, unknown> | undefined
        ): Record<string, unknown> | undefined => {
            const { getByTestId } = render(SkipAnimationsHarness as unknown as any, {
                props: {
                    parentTransition: { duration: 1, delay: 0.4 },
                    transition
                }
            })
            const value = getByTestId('transition-probe').getAttribute('data-transition')
            return value === null ? undefined : JSON.parse(value)
        }

        it('inherits the parent when its own transition is undefined', () => {
            expect(renderTransition(undefined)).toEqual({ duration: 1, delay: 0.4 })
        })

        it('resets an inherited transition with an empty object', () => {
            expect(renderTransition({})).toEqual({})
        })

        it('replaces the parent wholesale without inherit=true', () => {
            expect(renderTransition({ duration: 0.2 })).toEqual({ duration: 0.2 })
        })

        it('merges the parent and strips inherit when inherit=true', () => {
            expect(renderTransition({ duration: 0.2, inherit: true })).toEqual({
                duration: 0.2,
                delay: 0.4
            })
        })
    })
})
