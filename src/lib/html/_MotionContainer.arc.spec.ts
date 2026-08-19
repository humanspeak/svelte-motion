import { arc } from '$lib/utils/arc'
import { sleep } from '$lib/utils/testing'
import { render } from '@testing-library/svelte'
import { arc as upstreamArc, visualElementStore, type MotionPath } from 'motion-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MotionContainer from './_MotionContainer.svelte'

type Sample = { x: unknown; y: unknown; pathRotation: unknown; transform: string }

/**
 * Render a motion div animating `x` under the given path, then sample its
 * latest values and inline transform through the transition.
 *
 * @param props Motion props for the container (initial/animate/transition).
 * @param count Number of samples to collect.
 * @returns All samples plus the final one.
 */
const renderAndSample = async (
    props: Record<string, unknown>,
    count = 8
): Promise<{ samples: Sample[]; last: Sample }> => {
    const { container } = render(MotionContainer as unknown as any, {
        props: { tag: 'div', ...props }
    })
    await sleep(60)
    const el = container.firstElementChild as HTMLElement
    const visualElement = visualElementStore.get(el)!
    const samples: Sample[] = []
    for (let i = 0; i < count; i++) {
        await sleep(100)
        samples.push({
            x: visualElement.latestValues.x,
            y: visualElement.latestValues.y,
            pathRotation: visualElement.latestValues.pathRotation,
            transform: el.style.transform
        })
    }
    return { samples, last: samples.at(-1)! }
}

const arcProps = (path: MotionPath, initial: Record<string, unknown> = { x: 0, y: 0 }) => ({
    initial,
    animate: { x: 200 },
    transition: { duration: 0.6, ease: 'linear', path }
})

/** The sample nearest the middle of the 0→200 travel, asserted to exist. */
const midFlight = (samples: Sample[]) => {
    const mid = samples.find((s) => typeof s.x === 'number' && s.x > 60 && s.x < 140)
    expect(mid, `expected a mid-flight sample: ${JSON.stringify(samples)}`).toBeTruthy()
    return mid!
}

describe('_MotionContainer transition.path (arc)', () => {
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

    it('curves x/y along the arc and composes pathRotation onto transform', async () => {
        const { samples, last } = await renderAndSample(
            arcProps(arc({ strength: 1, rotate: true }))
        )

        const mid = midFlight(samples)
        expect(Math.abs(Number(mid.y))).toBeGreaterThan(30)
        expect(mid.transform).toMatch(/translateY\(/)
        expect(mid.transform).toMatch(/rotate\(/)
        expect(typeof mid.pathRotation).toBe('number')

        // Settles exactly; pathRotation is cleared.
        expect(last.x).toBe(200)
        expect(last.y).toBe(0)
        expect(last.transform).toBe('translateX(200px)')
    })

    it('rotate:false keeps transform free of rotate()', async () => {
        const { samples, last } = await renderAndSample(arcProps(arc({ strength: 1 })))

        expect(samples.some((entry) => entry.transform.includes('rotate('))).toBe(false)
        expect(samples.some((entry) => Math.abs(Number(entry.y)) > 30)).toBe(true)
        expect(last.x).toBe(200)
        expect(last.y).toBe(0)
        expect(last.transform).toBe('translateX(200px)')
    })

    it('keeps a user rotate in the transform while pathRotation is additive', async () => {
        const { samples, last } = await renderAndSample(
            arcProps(arc({ strength: 1, rotate: true }), { x: 0, y: 0, rotate: 45 })
        )

        const mid = midFlight(samples)
        expect(mid.transform).toMatch(/rotate\(45deg\) rotate\(/)
        expect(typeof mid.pathRotation).toBe('number')
        expect(last.x).toBe(200)
        expect(last.y).toBe(0)
        expect(last.transform).toBe('translateX(200px) rotate(45deg)')
    })

    it('falls back to a straight line (no NaN) when x/y endpoints carry units', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { samples, last } = await renderAndSample({
            initial: { x: '0px', y: 0 },
            animate: { x: '100px' },
            transition: { duration: 0.6, ease: 'linear', path: arc({ strength: 1 }) }
        })

        // Never NaN, never a y bulge, actually moves mid-flight, and arrives.
        // (Assert on latestValues: the browser refuses an invalid
        // `translateX(NaNpx)` write, so the transform string alone is vacuous.)
        expect(samples.some((entry) => Number.isNaN(entry.x))).toBe(false)
        expect(samples.some((entry) => Math.abs(Number(entry.y)) > 1)).toBe(false)
        expect(
            samples.some((entry) => {
                const px = parseFloat(String(entry.x))
                return Number.isFinite(px) && px > 5 && px < 95
            })
        ).toBe(true)
        expect(last.transform).toBe('translateX(100px)')
        expect(warn).toHaveBeenCalledTimes(1)
        expect(String(warn.mock.calls[0][0])).toMatch(/arc\(\) requires numeric x\/y/)
        warn.mockRestore()
    })

    it('documents the upstream hazard: raw motion-dom arc() emits NaN for px endpoints', async () => {
        // Pins WHY the wrapper exists. If this starts passing without NaN,
        // upstream fixed it and the guard in $lib/utils/arc can be retired.
        const { samples } = await renderAndSample(
            {
                initial: { x: '0px', y: 0 },
                animate: { x: '100px' },
                transition: { duration: 0.6, ease: 'linear', path: upstreamArc({ strength: 1 }) }
            },
            5
        )
        // NaN reaches latestValues; the invalid transform write is refused by
        // the browser, so the element freezes, then jumps on completion.
        expect(samples.some((entry) => Number.isNaN(entry.x))).toBe(true)
    })
})
