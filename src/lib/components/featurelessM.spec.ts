import { domMax } from '$lib'
import { flushTimers } from '$lib/__tests__/flushTimers'
import { resetWarnOnceForTests } from '$lib/utils/motionKind'
import { render, screen } from '@testing-library/svelte'
import { visualElementStore } from 'motion-dom'
import { tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FeaturelessMProbe from './__tests__/FeaturelessMProbe.svelte'
import FeaturelessParentProbe from './__tests__/FeaturelessParentProbe.svelte'
import FeaturelessPresenceProbe from './__tests__/FeaturelessPresenceProbe.svelte'
import FeaturelessStyleProbe from './__tests__/FeaturelessStyleProbe.svelte'
import FeaturelessSvgProbe from './__tests__/FeaturelessSvgProbe.svelte'

// Plan 016 (Motion parity). Upstream (Motion 14.7.1 `render/components/m/create.ts`,
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
    // The AnimatePresence measure effect observes size changes.
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        }
    )
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

describe('m without LazyMotion features', () => {
    it('an m outside LazyMotion has no VisualElement', async () => {
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

    it('an m waiting on an async bundle has no VisualElement, then animates from initial', async () => {
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
    })

    it('a late parent reaches its children', async () => {
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

    type StyleProbe = {
        setX: (value: number) => void
        getX: () => number
        setWillChange: (value: string) => void
        getWillChange: () => string
    }

    // U6. Upstream `use-props.ts:9-49` copies MotionValues' first-render value
    // only (`useConstant(visualState)`); without a node nothing re-reads them.
    it('a style MotionValue on a featureless m does not reach the DOM', async () => {
        const { component } = render(FeaturelessStyleProbe, { props: { wrap: 'none' } })
        await flushTimers()
        ;(component as unknown as StyleProbe).setX(50)
        await flushTimers()
        await flushTimers()

        expect(screen.getByTestId('box').style.transform).not.toContain('50px')
    })

    // U7 (guard). Upstream re-copies raw, non-forced style values every render.
    it('a raw style change still reaches a featureless m', async () => {
        const result = render(FeaturelessStyleProbe, { props: { wrap: 'none' } })
        await flushTimers()
        await result.rerender({ wrap: 'none', width: '20px' })
        await flushTimers()

        expect(screen.getByTestId('box').style.width).toBe('20px')
    })

    // U7b. Upstream `copyRawValuesOnly` skips forced keys (`use-props.ts:15`)
    // and renders them from the constant first-render `visualState`.
    it('a raw forced style key stays at its first-render value on a featureless m', async () => {
        const result = render(FeaturelessStyleProbe, { props: { wrap: 'none' } })
        await flushTimers()
        await result.rerender({ wrap: 'none', rawX: 20 })
        await flushTimers()

        const transform = screen.getByTestId('forced').style.transform
        expect(transform).toContain('10px')
        expect(transform).not.toContain('20px')
    })

    // U7c (guard). Once the node exists its `update()` renders raw forced keys.
    it('a late node follows a raw forced key after its bundle arrives', async () => {
        const features = createDeferred<typeof domMax>()
        const loader = async () => features.promise
        const result = render(FeaturelessStyleProbe, { props: { wrap: 'async', loader } })
        await flushTimers()
        features.resolve(domMax)
        await flushTimers()
        await flushTimers()
        await flushTimers()
        await result.rerender({ wrap: 'async', loader, rawX: 30 })
        await flushTimers()

        expect(screen.getByTestId('forced').style.transform).toContain('30px')
    })

    // U8. Upstream `VisualElement.ts:437-446`: a node created late resets each
    // style MotionValue to the first-render `visualState` value.
    it('a late node starts style MotionValues from the first render, then follows them', async () => {
        const features = createDeferred<typeof domMax>()
        const { component } = render(FeaturelessStyleProbe, {
            props: { wrap: 'async', loader: async () => features.promise }
        })
        await flushTimers()
        const probe = component as unknown as StyleProbe
        probe.setX(50)
        await flushTimers()

        features.resolve(domMax)
        await flushTimers()
        await flushTimers()
        await flushTimers()

        const box = screen.getByTestId('box')
        expect(probe.getX()).toBe(0)
        expect(box.style.transform).not.toContain('50px')

        probe.setX(80)
        await flushTimers()

        expect(box.style.transform).toContain('80px')
    })

    // Upstream `VisualElement.ts:437-446` leaves `willChange` out of the
    // constructor reset (`const { willChange, ...initialMotionValues }`).
    it('a late node does not reset a willChange MotionValue', async () => {
        const features = createDeferred<typeof domMax>()
        const { component } = render(FeaturelessStyleProbe, {
            props: { wrap: 'async', loader: async () => features.promise }
        })
        await flushTimers()
        const probe = component as unknown as StyleProbe
        probe.setWillChange('transform')
        await flushTimers()

        features.resolve(domMax)
        await flushTimers()
        await flushTimers()
        await flushTimers()

        expect(probe.getWillChange()).toBe('transform')
    })

    // U9. Upstream `useVisualElement` reads a parent that has no node.
    it('a motion child of a featureless m has no parent node', async () => {
        render(FeaturelessParentProbe)
        await flushTimers()
        const child = visualElementStore.get(screen.getByTestId('motion-child'))

        expect(child).toBeDefined()
        expect(child!.parent).toBeUndefined()
    })

    // U10 (guard). Upstream has no `pathLength` visibility hold at all.
    it('a featureless m.path with initial pathLength is visible', async () => {
        render(FeaturelessSvgProbe, { props: { wrap: 'none' } })
        await flushTimers()
        await flushTimers()

        expect(screen.getByTestId('path').style.visibility).not.toBe('hidden')
    })

    // U11. Without a node nothing animates `pathLength` towards `animate`.
    it('a featureless m.path keeps its initial pathLength', async () => {
        render(FeaturelessSvgProbe, { props: { wrap: 'none' } })
        const path = screen.getByTestId('path')
        const before = path.getAttribute('stroke-dasharray')

        for (let i = 0; i < 5; i++) await flushTimers()

        expect(path.getAttribute('stroke-dasharray')).toBe(before)
    })

    // U12. Upstream `exit.ts:73-83` registers with `PresenceChild` from the exit
    // feature, which needs a node; with nothing registered the child leaves at
    // once (`PresenceChild.tsx:104-113`).
    it('a featureless m with exit leaves AnimatePresence at once, without a clone', async () => {
        // jsdom has no WAAPI; the presence style capture calls it.
        const proto = Element.prototype as unknown as { getAnimations?: () => Animation[] }
        const originalGetAnimations = proto.getAnimations
        proto.getAnimations = () => []
        try {
            const result = render(FeaturelessPresenceProbe, { props: { show: true } })
            // Bounded: the presence capture re-arms its rAF every frame.
            await vi.advanceTimersByTimeAsync(50)
            await tick()
            await result.rerender({ show: false })
            await tick()

            expect(document.querySelectorAll('[data-clone="true"]').length).toBe(0)
            expect(screen.queryByTestId('leaver')).toBeNull()
        } finally {
            proto.getAnimations = originalGetAnimations
        }
    })
})
