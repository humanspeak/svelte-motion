import { flushTimers } from '$lib/__tests__/flushTimers'
import { resetWarnOnceForTests } from '$lib/utils/motionKind'
import { render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TapOptionsProbe from './__tests__/TapOptionsProbe.svelte'

// Motion 14.10 `tap`, `globalTapTarget` and `propagate` are gesture options
// (upstream `framer-motion/src/gestures/press.ts` `update()` at v14.10.1), not
// DOM attributes. They must be consumed by the component and never fall
// through `...rest` onto the element.

vi.mock('motion', async (importOriginal) => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { ...(await importOriginal<typeof import('motion')>()), animate: animateMock }
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

describe('tap options props do not leak to the DOM', () => {
    it('renders no tap, globaltaptarget or propagate attribute', async () => {
        render(TapOptionsProbe)
        await flushTimers()
        const btn = screen.getByTestId('btn')
        expect(btn.getAttribute('tap')).toBeNull()
        expect(btn.getAttribute('globaltaptarget')).toBeNull()
        expect(btn.getAttribute('globalTapTarget')).toBeNull()
        expect(btn.getAttribute('propagate')).toBeNull()
    })
})
