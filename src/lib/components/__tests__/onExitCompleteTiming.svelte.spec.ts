import { fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExitTimingHarness from './ExitTimingHarness.svelte'

// Resolve clone-path exit animations immediately (same approach as
// `src/lib/html/_MotionContainer.spec.ts`).
vi.mock('motion', () => ({
    animate: vi.fn(() => ({ finished: Promise.resolve() }))
}))

const flush = async () => {
    await tick()
    await tick()
}

const exitEntries = (log: string[]) => log.filter((entry) => entry.startsWith('exitComplete'))

/**
 * Upstream parity for framer-motion #2538 (Motion 14.3.1): `onExitComplete`
 * fires after the exiting children have unmounted, once per exit cycle.
 * Mirrors `AnimatePresence/__tests__/on-exit-complete-timing.test.tsx` @ v14.5.0.
 */
describe('AnimatePresence onExitComplete timing', () => {
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

    it('ordering: fires after PresenceChild-held children unmount', async () => {
        const log: string[] = []
        const { rerender } = render(ExitTimingHarness, { props: { present: true, log } })
        expect(screen.queryByTestId('exit-timing-child')).not.toBeNull()

        await rerender({ present: false, log })
        await fireEvent.click(screen.getByTestId('probe'))
        await flush()

        expect(log).toEqual(['cleanup', 'exitComplete:unmounted'])
    })

    it('once per cycle: fires exactly once for each exit cycle', async () => {
        const log: string[] = []
        const { rerender } = render(ExitTimingHarness, { props: { present: true, log } })

        await rerender({ present: false, log })
        await fireEvent.click(screen.getByTestId('probe'))
        await flush()

        await rerender({ present: true, log })
        await flush()
        expect(screen.queryByTestId('exit-timing-child')).not.toBeNull()

        await rerender({ present: false, log })
        await fireEvent.click(screen.getByTestId('probe'))
        await flush()

        expect(exitEntries(log)).toEqual(['exitComplete:unmounted', 'exitComplete:unmounted'])
    })

    it('clone path unchanged: plain {#if} children report unmounted', async () => {
        vi.useFakeTimers()
        // jsdom has no WAAPI; the motion container's layout capture calls it.
        const proto = Element.prototype as unknown as { getAnimations?: () => Animation[] }
        const originalGetAnimations = proto.getAnimations
        proto.getAnimations = () => []
        try {
            vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
                setTimeout(() => cb(0), 0)
                return 0
            })
            const log: string[] = []
            const { rerender } = render(ExitTimingHarness, {
                props: { present: true, log, variant: 'clone' }
            })
            await vi.advanceTimersByTimeAsync(50)
            expect(screen.queryByTestId('exit-timing-child')).not.toBeNull()

            await rerender({ present: false, log, variant: 'clone' })
            await vi.advanceTimersByTimeAsync(200)
            await flush()

            expect(exitEntries(log)).toEqual(['exitComplete:unmounted'])
            expect(screen.queryByTestId('exit-timing-child')).toBeNull()
        } finally {
            proto.getAnimations = originalGetAnimations
            vi.useRealTimers()
            vi.unstubAllGlobals()
        }
    })
})
