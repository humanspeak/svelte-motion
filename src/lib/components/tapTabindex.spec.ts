import { flushTimers } from '$lib/__tests__/flushTimers'
import { resetWarnOnceForTests } from '$lib/utils/motionKind'
import { render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TapTabindexProbe from './__tests__/TapTabindexProbe.svelte'

// Plan 016: `tabindex` comes from props, as upstream Motion 14.7.1
// `render/html/use-props.ts:76-81`: `tabIndex = 0` when no `tabIndex` is set
// and `onTap`, `onTapStart` or `whileTap` is truthy. Raw prop truthiness, no
// feature or tag check; `onTapCancel` is not in the list. The probe renders
// under `domMin`, so motion-dom's `press()` (which also sets `tabIndex` on
// mount) is never attached and only the prop-derived attribute can show.

vi.mock('motion', () => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { animate: animateMock }
})

beforeEach(() => {
    resetWarnOnceForTests()
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        setTimeout(() => cb(0), 0)
        return 0 as unknown as number
    })
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('tabindex from tap props (upstream use-props)', () => {
    const mount = async () => {
        render(TapTabindexProbe)
        await flushTimers()
    }

    it('onTap adds tabindex="0"', async () => {
        await mount()
        expect(screen.getByTestId('on-tap').getAttribute('tabindex')).toBe('0')
    })

    it('onTapStart adds tabindex="0"', async () => {
        await mount()
        expect(screen.getByTestId('on-tap-start').getAttribute('tabindex')).toBe('0')
    })

    it('onTapCancel alone adds no tabindex', async () => {
        await mount()
        expect(screen.getByTestId('on-tap-cancel').hasAttribute('tabindex')).toBe(false)
    })

    it('an unresolved whileTap label adds tabindex="0"', async () => {
        await mount()
        expect(screen.getByTestId('tap-label').getAttribute('tabindex')).toBe('0')
    })

    it('a natively focusable button with whileTap gets tabindex="0"', async () => {
        await mount()
        expect(screen.getByTestId('tap-button').getAttribute('tabindex')).toBe('0')
    })

    it('an explicit tabindex wins', async () => {
        await mount()
        expect(screen.getByTestId('tap-explicit').getAttribute('tabindex')).toBe('-1')
    })
})
