import PresenceHarness from '$lib/components/__tests__/PresenceHarness.svelte'
import PresenceProbe from '$lib/components/__tests__/PresenceProbe.svelte'
import { render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it } from 'vitest'

const probe = () => screen.getByTestId('probe')

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
    })
})
