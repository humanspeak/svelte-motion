import { domAnimation, domMax, domMin } from '$lib'
import { flushTimers } from '$lib/__tests__/flushTimers'
import { resetWarnOnceForTests } from '$lib/utils/motionKind'
import { render, screen } from '@testing-library/svelte'
import { visualElementStore } from 'motion-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LazyMotionKindProbe from './__tests__/LazyMotionKindProbe.svelte'
import LazyMotionProbe from './__tests__/LazyMotionProbe.svelte'

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

const createDeferred = <T>() => {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve
        reject = promiseReject
    })
    return { promise, resolve, reject }
}

const pointer = (type: string) =>
    new PointerEvent(type, {
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: type === 'pointerdown' ? 1 : 0,
        bubbles: true
    })

/**
 * Presses `element` and reports whether its `whileTap` state became active,
 * i.e. whether the tap gesture is attached. Releases the press afterwards.
 */
const tapActivates = (element: Element): boolean => {
    element.dispatchEvent(pointer('pointerdown'))
    const active = !!visualElementStore.get(element)?.animationState?.getState().whileTap.isActive
    element.dispatchEvent(pointer('pointerup'))
    window.dispatchEvent(pointer('pointerup'))
    return active
}

/** Whether `element` has a VisualElement. */
const hasNode = (element: Element): boolean => visualElementStore.get(element) !== undefined

describe('LazyMotion.svelte', () => {
    it('keeps animation features available with domMin', async () => {
        render(LazyMotionProbe, { props: { features: domMin } })
        await flushTimers()

        expect(await screen.findByTestId('box')).toBeTruthy()
    })

    // `tabindex` is prop-derived (upstream `use-props.ts:76-81`), so it is no
    // proxy for gesture features: press the element instead.
    it('does not attach the tap gesture with domMin', async () => {
        render(LazyMotionProbe, { props: { features: domMin } })
        await flushTimers()
        const tap = screen.getByTestId('tap')

        expect(hasNode(tap)).toBe(true)
        expect(tapActivates(tap)).toBe(false)
        expect(tap.getAttribute('tabindex')).toBe('0')
    })

    it('attaches the tap gesture with domAnimation', async () => {
        render(LazyMotionProbe, { props: { features: domAnimation } })
        await flushTimers()

        expect(tapActivates(screen.getByTestId('tap'))).toBe(true)
    })

    // Upstream `LazyMotion/index.tsx:58-66`: no renderer until the loader resolves.
    it('gives m no VisualElement until an async loader resolves', async () => {
        const features = createDeferred<typeof domAnimation>()

        render(LazyMotionProbe, {
            props: { features: async () => features.promise }
        })
        await flushTimers()

        expect(hasNode(screen.getByTestId('box'))).toBe(false)
        expect(hasNode(screen.getByTestId('tap'))).toBe(false)

        features.resolve(domAnimation)
        await flushTimers()

        expect(tapActivates(screen.getByTestId('tap'))).toBe(true)
    })

    // Upstream has no `.catch`: a rejected loader never publishes a renderer.
    it('gives m no VisualElement when an async loader rejects', async () => {
        render(LazyMotionProbe, {
            props: { features: async () => Promise.reject(new Error('failed to load features')) }
        })
        await flushTimers()
        await flushTimers()
        await flushTimers()

        expect(screen.getByTestId('box')).toBeTruthy()
        expect(hasNode(screen.getByTestId('box'))).toBe(false)
    })

    it('ignores stale async feature loaders after features change', async () => {
        const staleFeatures = createDeferred<typeof domMin>()
        const result = render(LazyMotionProbe, {
            props: { features: async () => staleFeatures.promise }
        })
        await flushTimers()

        await result.rerender({ features: domAnimation })
        await flushTimers()

        expect(tapActivates(screen.getByTestId('tap'))).toBe(true)

        staleFeatures.resolve(domMin)
        await flushTimers()

        expect(tapActivates(screen.getByTestId('tap'))).toBe(true)
    })

    // Upstream `render/components/motion/create.ts` preloads every feature
    // into `motion`; `m/create.ts` leaves `m` to LazyMotion (Motion 14.7.1).
    it('motion components keep every feature inside LazyMotion', async () => {
        render(LazyMotionKindProbe, { props: { features: domMin } })
        await flushTimers()

        expect(tapActivates(screen.getByTestId('motion-tap'))).toBe(true)
        expect(tapActivates(screen.getByTestId('m-tap'))).toBe(false)
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
