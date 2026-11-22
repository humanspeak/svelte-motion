import AnimatePresenceModeHarness from '$lib/components/__tests__/AnimatePresenceModeHarness.svelte'
import {
    getPresenceModeEffectRuns,
    getPresenceModeProbeMounts,
    readPresenceMode,
    resetPresenceModeProbe
} from '$lib/components/__tests__/PresenceModeProbe.svelte'
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * Render the harness under `sync`, then switch to `wait` and `popLayout`.
 *
 * @returns Resolves after the last rerender has flushed.
 */
const switchThroughModes = async () => {
    const { rerender } = render(AnimatePresenceModeHarness, { props: { mode: 'sync' } })
    await rerender({ mode: 'wait' })
    await tick()
    await rerender({ mode: 'popLayout' })
    await tick()
}

describe('AnimatePresence runtime mode (plan 011)', () => {
    beforeEach(resetPresenceModeProbe)

    it('the context reports the latest mode', async () => {
        const { rerender } = render(AnimatePresenceModeHarness, { props: { mode: 'sync' } })
        expect(readPresenceMode()).toBe('sync')
        await rerender({ mode: 'wait' })
        await tick()
        expect(readPresenceMode()).toBe('wait')
        await rerender({ mode: 'popLayout' })
        await tick()
        expect(readPresenceMode()).toBe('popLayout')
    })

    it('a mode change does not remount the children', async () => {
        await switchThroughModes()
        expect(getPresenceModeProbeMounts()).toBe(1)
    })

    it('reading context.mode in an effect does not subscribe to it', async () => {
        await switchThroughModes()
        expect(getPresenceModeEffectRuns()).toBe(1)
    })
})
