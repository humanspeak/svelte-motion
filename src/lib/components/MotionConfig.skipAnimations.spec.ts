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
})
