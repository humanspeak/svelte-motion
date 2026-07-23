import { afterEach, describe, expect, it, vi } from 'vitest'

/*
 * Laziness contract for `pwLog`.
 *
 * `log.ts` gates on `DEV` (from `esm-env`) AND `isPlaywrightEnv()` (which reads
 * `window.location.search`). We mock both of those exact inputs: `DEV` via a
 * module mock, and the Playwright flag via a stubbed `window`.
 *
 * Note on the red anchor: the production reflow cost this plan removes is not
 * observable in vitest — passing a thunk (`() => probe()`) never eagerly runs
 * the DOM reads regardless of `pwLog`'s implementation, because the argument is
 * a function reference. So the inactive-mode test documents the contract but is
 * not itself the red. The ACTIVE-mode test is the red: the pre-change `pwLog`
 * forwards the thunk straight to `console.log` (logging a function) instead of
 * invoking it and logging its return value, so the payload assertion fails.
 */

vi.mock('esm-env', () => ({ DEV: true }))

const { pwLog } = await import('./log')

describe('pwLog laziness contract', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('does not invoke a thunk payload when logging is inactive', () => {
        // No `@isPlaywright=true` flag → pwLog is a no-op.
        vi.stubGlobal('window', { location: { search: '' } })
        const probe = vi.fn(() => ({ w: 1, h: 2 }))
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        pwLog('[tap] animate-tap', probe)

        expect(probe).not.toHaveBeenCalled()
        expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('invokes the thunk and logs its return value when active', () => {
        vi.stubGlobal('window', { location: { search: '?@isPlaywright=true' } })
        const payload = { w: 1, h: 2 }
        const probe = vi.fn(() => payload)
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        pwLog('[tap] animate-tap', probe)

        expect(probe).toHaveBeenCalledTimes(1)
        expect(consoleSpy).toHaveBeenCalledWith('[tap] animate-tap', payload)
    })

    it('still logs a plain (non-thunk) payload object unchanged', () => {
        vi.stubGlobal('window', { location: { search: '?@isPlaywright=true' } })
        const payload = { a: 1 }
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        pwLog('[tap] plain', payload)

        expect(consoleSpy).toHaveBeenCalledWith('[tap] plain', payload)
    })
})
