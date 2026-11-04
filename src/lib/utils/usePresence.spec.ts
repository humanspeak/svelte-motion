import AnimatePresenceDataHarness from '$lib/components/__tests__/AnimatePresenceDataHarness.svelte'
import EmptyWaitSwapHarness from '$lib/components/__tests__/EmptyWaitSwapHarness.svelte'
import FakePresenceContextHarness from '$lib/components/__tests__/FakePresenceContextHarness.svelte'
import LegacyWarnHarness from '$lib/components/__tests__/LegacyWarnHarness.svelte'
import MidHoldDestroyHarness from '$lib/components/__tests__/MidHoldDestroyHarness.svelte'
import MountFlipPresenceHarness, {
    getMountFlipMounts,
    resetMountFlipMounts
} from '$lib/components/__tests__/MountFlipPresenceHarness.svelte'
import PresenceDataProbe from '$lib/components/__tests__/PresenceDataProbe.svelte'
import PresenceHarness from '$lib/components/__tests__/PresenceHarness.svelte'
import PresenceProbe from '$lib/components/__tests__/PresenceProbe.svelte'
import {
    getShapeLog,
    getShapeState,
    resetShape
} from '$lib/components/__tests__/PresenceShapeProbe.svelte'
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

        it('keeps the children through a present → false flip made from an onMount, before the phase effect (plan 012 A5)', async () => {
            // Upstream's PresenceChild renders its children through the flip
            // (PresenceChild.tsx:115-125 @ v14.7.1). A child destroyed and
            // re-created already not present never relegated its layoutId
            // node, which stayed the stack's present lead.
            resetMountFlipMounts()
            render(MountFlipPresenceHarness)
            await tick()

            expect(getMountFlipMounts()).toBe(1)
            expect(screen.getByTestId('flip-child').dataset.mount).toBe('1')
            expect(probe().getAttribute('data-is-present')).toBe('false')
            expect(probe().getAttribute('data-tuple-has-callback')).toBe('true')
        })

        it('creates the children once when present stays true (plan 012 A5)', async () => {
            resetMountFlipMounts()
            render(MountFlipPresenceHarness, { props: { flipOnMount: false } })
            await tick()

            expect(getMountFlipMounts()).toBe(1)
            expect(probe().getAttribute('data-is-present')).toBe('true')
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

    // Plan 017. Upstream `usePresence` registers one participant per component
    // instance (use-presence.ts:52-57 @ v14.7.1) and its `safeToRemove`
    // completes only that participant (:59-62).
    describe('registers one participant (plan 017)', () => {
        const fakeRegister = () => {
            const dispose = vi.fn()
            const register = vi.fn<(id: string | number) => () => void>(() => dispose)
            return { register, dispose }
        }

        it('registers one participant at init and unregisters on destroy', async () => {
            const { register, dispose } = fakeRegister()
            const { rerender } = render(FakePresenceContextHarness, {
                props: { present: true, register }
            })
            expect(register).toHaveBeenCalledTimes(1)
            expect(dispose).not.toHaveBeenCalled()
            await rerender({ show: false })
            await tick()
            expect(dispose).toHaveBeenCalledTimes(1)
        })

        it('never registers again across presence flips', async () => {
            const { register } = fakeRegister()
            const { rerender } = render(FakePresenceContextHarness, {
                props: { present: true, register }
            })
            await rerender({ present: false })
            await tick()
            await rerender({ present: true })
            await tick()
            await rerender({ present: false })
            await tick()
            expect(register).toHaveBeenCalledTimes(1)
        })

        it('returns a frozen two-item array whose items follow the wrapper', async () => {
            resetShape()
            const { rerender } = render(PresenceHarness, { props: { present: true, shape: true } })
            const state = getShapeState()!
            expect(Array.isArray(state)).toBe(true)
            expect(state.length).toBe(2)
            expect(Object.isFrozen(state)).toBe(true)
            expect(state[0]).toBe(true)
            expect(state[1]).toBeNull()
            await rerender({ present: false })
            await tick()
            expect(state[0]).toBe(false)
            expect(typeof state[1]).toBe('function')
        })

        it('destructuring inside $effect re-runs on every flip', async () => {
            resetShape()
            const { rerender } = render(PresenceHarness, { props: { present: true, shape: true } })
            await tick()
            await rerender({ present: false })
            await tick()
            await rerender({ present: true })
            await tick()
            expect(
                getShapeLog().map(({ isPresent, hasCallback }) => `${isPresent}/${hasCallback}`)
            ).toEqual(['true/false', 'false/true', 'true/false'])
        })

        it('safeToRemove keeps its identity within a cycle and changes across cycles', async () => {
            resetShape()
            const { rerender } = render(PresenceHarness, { props: { present: true, shape: true } })
            const state = getShapeState()!
            await rerender({ present: false })
            await tick()
            const first = state[1]
            expect(typeof first).toBe('function')
            expect(state[1]).toBe(first)
            await rerender({ present: true })
            await tick()
            await rerender({ present: false })
            await tick()
            const second = state[1]
            expect(typeof second).toBe('function')
            expect(second).not.toBe(first)
        })

        it('its safeToRemove completes only its own participant', async () => {
            const { rerender } = render(PresenceHarness, { props: { present: true, count: 2 } })
            await rerender({ present: false })
            await tick()
            const [first, second] = screen.getAllByTestId('probe')
            first.click()
            await tick()
            await vi.advanceTimersByTimeAsync(100)
            expect(screen.getAllByTestId('probe')).toHaveLength(2)
            second.click()
            await tick()
            expect(screen.queryAllByTestId('probe')).toHaveLength(0)
        })

        it('useIsPresent never registers', async () => {
            const { register } = fakeRegister()
            const { rerender } = render(FakePresenceContextHarness, {
                props: { present: true, register, probe: 'is-present' }
            })
            await rerender({ present: false })
            await tick()
            await rerender({ present: true })
            await tick()
            expect(screen.getByTestId('is-present-probe').getAttribute('data-is-present')).toBe(
                'true'
            )
            expect(register).not.toHaveBeenCalled()
        })
    })

    describe('legacy $derived(usePresence()) (plan 017)', () => {
        it('legacy $derived(usePresence()) never registers and marks the wrapper', async () => {
            const register = vi.fn<(id: string | number) => () => void>(() => () => {})
            const markLegacyManual = vi.fn(() => true)
            const { rerender } = render(FakePresenceContextHarness, {
                props: { present: true, register, markLegacyManual, probe: 'legacy' }
            })
            await rerender({ present: false })
            await tick()
            await rerender({ present: true })
            await tick()
            await rerender({ present: false })
            await tick()
            expect(register).not.toHaveBeenCalled()
            expect(markLegacyManual.mock.calls.length).toBeGreaterThanOrEqual(1)
        })

        it('legacy consumer holds an otherwise empty wrapper, then releases it whole', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
            try {
                const { rerender } = render(PresenceHarness, {
                    props: { present: true, legacy: true }
                })
                await rerender({ present: false })
                await vi.advanceTimersByTimeAsync(2000)
                const legacy = screen.getByTestId('legacy-probe')
                expect(legacy.getAttribute('data-is-present')).toBe('false')
                legacy.click()
                await tick()
                expect(screen.queryByTestId('legacy-probe')).toBeNull()
            } finally {
                warn.mockRestore()
            }
        })

        it('warns once per legacy wrapper in dev', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
            try {
                const { rerender } = render(LegacyWarnHarness, { props: { present: true } })
                await rerender({ present: false })
                await tick()
                await rerender({ present: true })
                await tick()
                const migrations = warn.mock.calls.filter((call) =>
                    call.some(
                        (arg) =>
                            typeof arg === 'string' &&
                            arg.includes('const presence = usePresence()')
                    )
                )
                expect(migrations).toHaveLength(2)
            } finally {
                warn.mockRestore()
            }
        })
    })

    // Plan 017. A PresenceChild that nothing registered with completes from
    // upstream's post-commit effect (PresenceChild.tsx:104-113 @ v14.7.1).
    describe('a wrapper with nothing registered (plan 017)', () => {
        it('a wrapper with nothing registered leaves at once', async () => {
            const onExitComplete = vi.fn()
            const { rerender } = render(MidHoldDestroyHarness, {
                props: { outer: true, inner: true, probe: false, onExitComplete }
            })
            expect(screen.queryByTestId('held-child')).not.toBeNull()
            await rerender({ outer: true, inner: false, probe: false, onExitComplete })
            await tick()
            await tick()
            expect(screen.queryByTestId('held-child')).toBeNull()
            expect(onExitComplete).toHaveBeenCalledTimes(1)
            await vi.advanceTimersByTimeAsync(1000)
            expect(onExitComplete).toHaveBeenCalledTimes(1)
        })

        it('wait mode: an empty leaver lets the next child in, notified once', async () => {
            const onExitComplete = vi.fn()
            const { rerender } = render(EmptyWaitSwapHarness, {
                props: { slot: 'a', onExitComplete }
            })
            expect(screen.queryByTestId('slot-a')).not.toBeNull()
            expect(screen.queryByTestId('slot-b')).toBeNull()
            await rerender({ slot: 'b', onExitComplete })
            await vi.advanceTimersByTimeAsync(100)
            expect(screen.queryByTestId('slot-a')).toBeNull()
            expect(screen.queryByTestId('slot-b')).not.toBeNull()
            expect(onExitComplete).toHaveBeenCalledTimes(1)
        })

        it('a re-entry before the microtask keeps the wrapper', async () => {
            // `rerender` flushes each prop write synchronously (`flushSync`), so
            // two calls without an await start the exit and re-enter before
            // the exit-start microtask runs.
            const run = async (probe: boolean) => {
                const onExitComplete = vi.fn()
                const result = render(MidHoldDestroyHarness, {
                    props: { outer: true, inner: true, probe, onExitComplete }
                })
                void result.rerender({ outer: true, inner: false, probe, onExitComplete })
                void result.rerender({ outer: true, inner: true, probe, onExitComplete })
                await tick()
                await vi.advanceTimersByTimeAsync(1000)
                const mounted = screen.queryByTestId('held-child') !== null
                const calls = onExitComplete.mock.calls.length
                result.unmount()
                return { mounted, calls }
            }
            const empty = await run(false)
            const held = await run(true)
            expect(empty.mounted).toBe(true)
            expect(held.mounted).toBe(true)
            expect(empty.calls).toBe(held.calls)
        })
    })
})
