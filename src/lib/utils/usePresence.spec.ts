import AnimatePresenceDataHarness from '$lib/components/__tests__/AnimatePresenceDataHarness.svelte'
import MidHoldDestroyHarness from '$lib/components/__tests__/MidHoldDestroyHarness.svelte'
import PresenceDataProbe from '$lib/components/__tests__/PresenceDataProbe.svelte'
import PresenceHarness from '$lib/components/__tests__/PresenceHarness.svelte'
import PresenceProbe from '$lib/components/__tests__/PresenceProbe.svelte'
import StalePresenceHarness from '$lib/components/__tests__/StalePresenceHarness.svelte'
import {
    getCapturedSafeToRemove,
    resetCapturedSafeToRemove
} from '$lib/components/__tests__/StalePresenceProbe.svelte'
import { render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'

const probe = () => screen.getByTestId('probe')
const presenceDataProbe = () => screen.getByTestId('presence-data-probe')

describe('utils/usePresence', () => {
    describe('outside any PresenceChild', () => {
        it('useIsPresent returns true', () => {
            render(PresenceProbe)
            expect(probe().getAttribute('data-is-present')).toBe('true')
        })

        it('usePresence returns [true, null]', () => {
            render(PresenceProbe)
            expect(probe().getAttribute('data-tuple-is-present')).toBe('true')
            expect(probe().getAttribute('data-tuple-has-callback')).toBe('false')
        })

        it('usePresenceData returns undefined outside AnimatePresence', () => {
            render(PresenceDataProbe)
            expect(presenceDataProbe().getAttribute('data-value')).toBe('undefined')
        })
    })

    describe('inside AnimatePresence', () => {
        it('usePresenceData returns custom data passed to AnimatePresence', () => {
            render(AnimatePresenceDataHarness, { props: { custom: 0.5 } })
            expect(presenceDataProbe().getAttribute('data-value')).toBe('0.5')
        })

        it('usePresenceData tracks updated AnimatePresence custom data', async () => {
            const { rerender } = render(AnimatePresenceDataHarness, {
                props: { custom: 1 }
            })
            expect(presenceDataProbe().getAttribute('data-value')).toBe('1')

            await rerender({ custom: -1 })
            await tick()
            expect(presenceDataProbe().getAttribute('data-value')).toBe('-1')
        })
    })

    describe('inside PresenceChild', () => {
        it('reports present while present={true}', () => {
            render(PresenceHarness, { props: { present: true } })
            expect(probe().getAttribute('data-is-present')).toBe('true')
            expect(probe().getAttribute('data-tuple-is-present')).toBe('true')
            expect(probe().getAttribute('data-tuple-has-callback')).toBe('false')
        })

        it('flips to not-present and exposes safeToRemove when present goes false', async () => {
            const { rerender } = render(PresenceHarness, { props: { present: true } })
            await rerender({ present: false })
            await tick()
            expect(probe().getAttribute('data-is-present')).toBe('false')
            expect(probe().getAttribute('data-tuple-is-present')).toBe('false')
            expect(probe().getAttribute('data-tuple-has-callback')).toBe('true')
        })

        it('safeToRemove unmounts the children', async () => {
            const { rerender } = render(PresenceHarness, { props: { present: true } })
            await rerender({ present: false })
            await tick()
            // Trigger safeToRemove by clicking the probe (handler fires safeToRemove())
            probe().click()
            await tick()
            expect(screen.queryByTestId('probe')).toBeNull()
        })

        it('safeToRemove is idempotent — second call is a no-op', async () => {
            const { rerender } = render(PresenceHarness, { props: { present: true } })
            await rerender({ present: false })
            await tick()
            const node = probe()
            node.click()
            await tick()
            // Second click on a detached node should not throw or re-fire.
            expect(() => node.click()).not.toThrow()
            expect(screen.queryByTestId('probe')).toBeNull()
        })

        it('a captured safeToRemove from a canceled exit does NOT complete a later exit', async () => {
            // Regression for the case where a consumer captures the callback
            // (setTimeout, external library, async work) during cycle A, exit
            // A is canceled by re-entry, cycle B starts, and the stale
            // callback fires while phase is 'holding' again. The stale call
            // must no-op, leaving cycle B in flight.
            resetCapturedSafeToRemove()
            const { rerender } = render(StalePresenceHarness, { props: { present: true } })

            // Cycle A starts; probe captures cycle A's callback.
            await rerender({ present: false })
            await tick()
            const staleFromA = getCapturedSafeToRemove()
            expect(staleFromA).toBeInstanceOf(Function)

            // Re-enter cancels cycle A.
            await rerender({ present: true })
            await tick()

            // Cycle B starts; probe captures cycle B's callback.
            await rerender({ present: false })
            await tick()
            const freshFromB = getCapturedSafeToRemove()
            expect(freshFromB).toBeInstanceOf(Function)
            expect(freshFromB).not.toBe(staleFromA)

            // Invoke the stale callback from A. It must NOT complete B.
            staleFromA?.()
            await tick()
            expect(screen.queryByTestId('probe')).not.toBeNull()
            expect(screen.getByTestId('probe').getAttribute('data-is-present')).toBe('false')

            // The fresh callback from B still works and completes the exit.
            freshFromB?.()
            await tick()
            expect(screen.queryByTestId('probe')).toBeNull()
        })

        it('re-entry mid-hold cancels the exit and the stale safeToRemove no-ops', async () => {
            const { rerender } = render(PresenceHarness, { props: { present: true } })
            await rerender({ present: false })
            await tick()
            const staleNode = probe()
            // Re-enter before the consumer signals completion.
            await rerender({ present: true })
            await tick()
            expect(probe().getAttribute('data-is-present')).toBe('true')
            // Calling the previously-handed-out safeToRemove must NOT unmount
            // the now-present component.
            staleNode.click()
            await tick()
            expect(screen.queryByTestId('probe')).not.toBeNull()
            expect(probe().getAttribute('data-is-present')).toBe('true')
        })

        it('settles exit accounting when the wrapper unmounts mid-hold (motion#3707 analogue)', async () => {
            const onExitComplete = vi.fn()
            const { rerender } = render(MidHoldDestroyHarness, {
                props: { outer: true, inner: true, onExitComplete }
            })
            expect(screen.queryByTestId('held-child')).not.toBeNull()

            // Start a held exit; the consumer never calls safeToRemove.
            await rerender({ outer: true, inner: false, onExitComplete })
            await tick()
            expect(screen.queryByTestId('held-child')).not.toBeNull()
            expect(onExitComplete).not.toHaveBeenCalled()

            // Destroy the PresenceChild while it's holding. The wrapper must
            // settle its in-flight exit on the way out — otherwise the
            // AnimatePresence counter leaks and mode='wait' blocks sibling
            // enters forever.
            await rerender({ outer: false, inner: false, onExitComplete })
            await vi.advanceTimersByTimeAsync(100)
            expect(onExitComplete).toHaveBeenCalledTimes(1)
        })
    })
})
