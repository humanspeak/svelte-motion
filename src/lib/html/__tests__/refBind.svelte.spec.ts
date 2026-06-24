import { flushTimers } from '$lib/__tests__/flushTimers'
import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'

import RefBindHarness from './RefBindHarness.svelte'

vi.mock('motion', () => ({
    animate: vi.fn(() => ({ finished: Promise.resolve(), stop: vi.fn() }))
}))

describe('bind:ref={$state()} (#417)', () => {
    it('mounts a motion element, void element, and _MotionContainer without throwing props_invalid_value', async () => {
        const onRefs = vi.fn()

        // Before the fix this threw synchronously at mount because `ref`
        // defaulted to `$bindable(null)`; binding a `$state()` (undefined)
        // against a non-undefined fallback trips Svelte's `props_invalid_value`.
        expect(() => render(RefBindHarness, { props: { onRefs } })).not.toThrow()

        await flushTimers()

        // The harness emits the latest ref snapshot whenever a bound `$state()`
        // updates; the final emission proves each bindable propagated the node
        // back to the consumer (not just that the element rendered).
        const refs = onRefs.mock.lastCall?.[0] ?? {}
        expect(refs.div?.tagName).toBe('DIV')
        expect(refs.source?.tagName).toBe('SOURCE')
        expect(refs.container?.tagName).toBe('SPAN')
    })

    it('resets each bound ref to null when the element unmounts', async () => {
        const onRefs = vi.fn()
        const { rerender } = render(RefBindHarness, { props: { show: true, onRefs } })
        await flushTimers()
        expect(onRefs.mock.lastCall?.[0]?.div?.tagName).toBe('DIV')

        // Unmount the bound elements. The teardown side of the contract must
        // reset the consumer's `$state()` back to null (matching native
        // `bind:this`) rather than leave a stale node reference behind.
        await rerender({ show: false, onRefs })
        await flushTimers()

        const refs = onRefs.mock.lastCall?.[0] ?? {}
        expect(refs.div).toBeNull()
        expect(refs.source).toBeNull()
        expect(refs.container).toBeNull()
    })
})
