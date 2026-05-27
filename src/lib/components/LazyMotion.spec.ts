import { domAnimation, domMin } from '$lib'
import { render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LazyMotionProbe from './__tests__/LazyMotionProbe.svelte'

vi.mock('motion', () => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { animate: animateMock }
})

beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        setTimeout(() => cb(0), 0)
        return 0 as unknown as number
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
})

const flushTimers = async () => {
    vi.runAllTimers()
    await Promise.resolve()
}

describe('LazyMotion.svelte', () => {
    it('keeps animation features available with domMin', async () => {
        render(LazyMotionProbe, { props: { features: domMin } })
        await flushTimers()

        expect(await screen.findByTestId('box')).toBeTruthy()
    })

    it('does not attach gesture affordances with domMin', async () => {
        render(LazyMotionProbe, { props: { features: domMin } })
        await flushTimers()

        expect(screen.getByTestId('tap').hasAttribute('tabindex')).toBe(false)
    })

    it('enables gesture affordances with domAnimation', async () => {
        render(LazyMotionProbe, { props: { features: domAnimation } })
        await flushTimers()

        expect(screen.getByTestId('tap').getAttribute('tabindex')).toBe('0')
    })
})
