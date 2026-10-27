import { domAnimation, domMax, domMin } from '$lib'
import { flushTimers } from '$lib/__tests__/flushTimers'
import { resetWarnOnceForTests } from '$lib/utils/motionKind'
import { render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LazyMotionKindProbe from './__tests__/LazyMotionKindProbe.svelte'
import LazyMotionProbe from './__tests__/LazyMotionProbe.svelte'

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

    // Upstream `render/components/motion/create.ts` preloads every feature
    // into `motion`; `m/create.ts` leaves `m` to LazyMotion (Motion 14.7.1).
    it('motion components keep every feature inside LazyMotion', async () => {
        render(LazyMotionKindProbe, { props: { features: domMin } })
        await flushTimers()

        expect(screen.getByTestId('motion-tap').getAttribute('tabindex')).toBe('0')
        expect(screen.getByTestId('m-tap').hasAttribute('tabindex')).toBe(false)
    })

    // Upstream `motion/index.tsx` `useStrictMode` (#2094): `invariant` throws.
    it('throws when a motion component renders inside LazyMotion strict', () => {
        let error: unknown
        try {
            render(LazyMotionKindProbe, {
                props: { features: domMax, strict: true, include: 'motion' }
            })
        } catch (caught) {
            error = caught
        }

        expect(error).toBeInstanceOf(Error)
        const message = (error as Error).message
        expect(message).toContain(
            'You have rendered a `motion` component within a `LazyMotion` component'
        )
        // Svelte's dev build appends the component stack after a blank line.
        expect(
            message.split('\n')[0].endsWith('https://motion.dev/troubleshooting/lazy-strict-mode')
        ).toBe(true)
    })

    it('m components render inside LazyMotion strict without warnings', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

        expect(() =>
            render(LazyMotionKindProbe, {
                props: { features: domMax, strict: true, include: 'm' }
            })
        ).not.toThrow()
        await flushTimers()

        expect(screen.getByTestId('m-tap')).toBeTruthy()
        expect(warn).not.toHaveBeenCalled()
        warn.mockRestore()
    })
})
