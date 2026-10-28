import { domMax } from '$lib'
import { flushTimers } from '$lib/__tests__/flushTimers'
import { resetWarnOnceForTests } from '$lib/utils/motionKind'
import { render, screen } from '@testing-library/svelte'
import { visualElementStore } from 'motion-dom'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FeaturelessMProbe from './__tests__/FeaturelessMProbe.svelte'

// Spike 011 anchors. Upstream (Motion 14.7.1 `render/components/m/create.ts`,
// `motion/utils/use-visual-element.ts`) gives an `m` no VisualElement until
// `<LazyMotion>` publishes a renderer: it renders `style`, `initial` and the
// prop-derived attributes (`render/html/use-props.ts`) and does nothing else.
// When the renderer arrives late, the node is created with
// `manuallyAnimateOnMount = true` and animates in from `initial`.

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
    const promise = new Promise<T>((promiseResolve) => {
        resolve = promiseResolve
    })
    return { promise, resolve }
}

describe('m without LazyMotion features (spike 011)', () => {
    it.fails('an m outside LazyMotion has no VisualElement', async () => {
        render(FeaturelessMProbe, { props: { wrap: 'none' } })
        const box = screen.getByTestId('box')

        expect(visualElementStore.get(box)).toBeUndefined()
        expect(box.style.width).toBe('10px')
        expect(box.style.opacity).toBe('0')

        await flushTimers()
        await flushTimers()

        expect(visualElementStore.get(box)).toBeUndefined()
        expect(box.style.opacity).toBe('0')
    })

    // Guard: upstream `use-props.ts` derives these from props, and today the
    // bare `m` still has `domMax`, so this passes before and after the build.
    it('an m outside LazyMotion keeps the prop-derived attributes', async () => {
        render(FeaturelessMProbe, { props: { wrap: 'none' } })
        await flushTimers()
        const box = screen.getByTestId('box')

        expect(box.getAttribute('tabindex')).toBe('0')
        expect(box.getAttribute('draggable')).toBe('false')
        expect(box.style.touchAction).toBe('pan-y')
        expect(box.style.userSelect).toBe('none')
    })

    it.fails(
        'an m waiting on an async bundle has no VisualElement, then animates from initial',
        async () => {
            const features = createDeferred<typeof domMax>()
            render(FeaturelessMProbe, {
                props: { wrap: 'async', loader: async () => features.promise }
            })
            await flushTimers()
            const box = screen.getByTestId('box')

            expect(visualElementStore.get(box)).toBeUndefined()
            expect(box.style.opacity).toBe('0')

            features.resolve(domMax)
            // Let the bundle reach the component without running any frame,
            // so the node exists but its enter animation hasn't stepped yet.
            await Promise.resolve()
            await Promise.resolve()
            await tick()

            const node = visualElementStore.get(box)
            expect(node).toBeDefined()
            expect(node!.latestValues.opacity).toBe(0)
            const startedFrom: unknown[] = []
            node!.on('AnimationStart', () => startedFrom.push(node!.latestValues.opacity))

            for (let i = 0; i < 5; i++) await flushTimers()

            // The enter animation ran, starting from `initial`, and settled on `animate`.
            expect(startedFrom[0]).toBe(0)
            expect(node!.latestValues.opacity).toBe(1)
        }
    )

    it.fails('a late parent reaches its children', async () => {
        const features = createDeferred<typeof domMax>()
        render(FeaturelessMProbe, {
            props: { wrap: 'async', loader: async () => features.promise, withChild: true }
        })
        await flushTimers()
        const box = screen.getByTestId('box')
        const child = screen.getByTestId('child')

        // Precondition: neither node exists while the bundle is pending.
        expect(visualElementStore.get(box)).toBeUndefined()
        expect(visualElementStore.get(child)).toBeUndefined()

        features.resolve(domMax)
        await flushTimers()
        await flushTimers()

        const boxNode = visualElementStore.get(box)
        const childNode = visualElementStore.get(child)
        expect(boxNode).toBeDefined()
        expect(childNode?.parent).toBe(boxNode)
        // Variant inheritance: the child registers as the late parent's variant child.
        expect(boxNode?.variantChildren?.has(childNode!)).toBe(true)
    })

    // Guard: a sync bundle publishes its renderer during render.
    it('an m inside a sync LazyMotion has a VisualElement immediately', async () => {
        render(FeaturelessMProbe, { props: { wrap: 'sync' } })
        await flushTimers()

        expect(visualElementStore.get(screen.getByTestId('box'))).toBeDefined()
    })
})
