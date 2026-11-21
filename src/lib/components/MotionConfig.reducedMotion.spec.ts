/**
 * `<MotionConfig reducedMotion>` follows Motion: under a reducing policy the
 * target is kept and only the tween is dropped for positional keys
 * (transforms, width/height, top/left/right/bottom), which jump to their
 * target, while every other value keeps its transition.
 *
 * Upstream: motion-dom `animation/interfaces/visual-element-target.ts:150-164`
 * @ v14.14.0 (`shouldReduceMotion && positionalKeys.has(key) ? { type: false }
 * : valueTransition`).
 */
import type { ReducedMotionConfig } from '$lib/types.js'
import { sleep } from '$lib/utils/testing'
import { render } from '@testing-library/svelte'
import { visualElementStore } from 'motion-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReducedMotionHarness from './__tests__/ReducedMotionHarness.svelte'

describe('MotionConfig.reducedMotion', () => {
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

    /** Render the harness, settle a few frames, and read the node's live values. */
    const renderAndRead = async (
        reducedMotion: ReducedMotionConfig | undefined
    ): Promise<Record<string, unknown>> => {
        const { container } = render(ReducedMotionHarness as unknown as any, {
            props: { reducedMotion }
        })
        await sleep(120)
        const el = container.querySelector('div') as HTMLElement
        return visualElementStore.get(el)!.latestValues
    }

    it("'always' jumps transforms to the target", async () => {
        expect((await renderAndRead('always')).x).toBe(200)
    })

    it("'always' still tweens opacity", async () => {
        const opacity = Number((await renderAndRead('always')).opacity)
        expect(opacity).toBeGreaterThan(0)
        expect(opacity).toBeLessThan(0.5)
    })

    it("'never' tweens transforms", async () => {
        const x = Number((await renderAndRead('never')).x)
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThan(190)
    })

    it("no reducedMotion (default 'never') tweens transforms", async () => {
        const x = Number((await renderAndRead(undefined)).x)
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThan(190)
    })

    it('applies a changed policy to the next animation without remounting', async () => {
        const { container, rerender } = render(ReducedMotionHarness as unknown as any, {
            props: { reducedMotion: 'never', animateX: 200 }
        })
        await sleep(100)

        const el = container.querySelector('div') as HTMLElement
        const visualElement = visualElementStore.get(el)!
        expect(Number(visualElement.latestValues.x)).toBeLessThan(190)

        await rerender({ reducedMotion: 'always', animateX: 400 })
        await sleep(100)

        expect(container.querySelector('div')).toBe(el)
        expect(visualElementStore.get(el)).toBe(visualElement)
        expect(visualElement.latestValues.x).toBe(400)
    })
})
