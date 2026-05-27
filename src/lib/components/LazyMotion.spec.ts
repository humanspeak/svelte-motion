import { domAnimation, domMin } from '$lib'
import { render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
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
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

const flushTimers = async () => {
    vi.runAllTimers()
    await Promise.resolve()
    await Promise.resolve()
    await tick()
}

const createDeferred = <T>() => {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve
        reject = promiseReject
    })
    return { promise, resolve, reject }
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

    it('upgrades async lazy features from domMin when the loader resolves', async () => {
        const features = createDeferred<typeof domAnimation>()

        render(LazyMotionProbe, {
            props: { features: async () => features.promise }
        })
        await flushTimers()

        expect(screen.getByTestId('tap').hasAttribute('tabindex')).toBe(false)

        features.resolve(domAnimation)
        await flushTimers()

        expect(screen.getByTestId('tap').getAttribute('tabindex')).toBe('0')
    })

    it('stays on domMin when an async lazy feature loader rejects', async () => {
        render(LazyMotionProbe, {
            props: { features: async () => Promise.reject(new Error('failed to load features')) }
        })
        await flushTimers()

        expect(screen.getByTestId('box')).toBeTruthy()
        expect(screen.getByTestId('tap').hasAttribute('tabindex')).toBe(false)
    })

    it('ignores stale async feature loaders after features change', async () => {
        const staleFeatures = createDeferred<typeof domMin>()
        const result = render(LazyMotionProbe, {
            props: { features: async () => staleFeatures.promise }
        })
        await flushTimers()

        expect(screen.getByTestId('tap').hasAttribute('tabindex')).toBe(false)

        await result.rerender({ features: domAnimation })
        await flushTimers()

        expect(screen.getByTestId('tap').getAttribute('tabindex')).toBe('0')

        staleFeatures.resolve(domMin)
        await flushTimers()

        expect(screen.getByTestId('tap').getAttribute('tabindex')).toBe('0')
    })
})
