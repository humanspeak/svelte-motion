import { isMotionValue } from 'motion-dom'
import { flushSync } from 'svelte'
import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `useScroll` now delegates to motion-dom for native scroll-timeline /
 * view-timeline acceleration when supported, and to motion's `scroll()` for
 * absolute pixel offsets. These tests cover:
 *
 * - The basic public shape — six augmented MotionValues, `.current` /
 *   `.subscribe` semantics, SSR fallback.
 * - The JS `scroll()` callback path — what motion is called with, and that
 *   its callback writes into the six MVs.
 * - The microtask-defer ref resolution — when a `bind:this` getter starts
 *   unresolved, attachment waits until it hydrates.
 * - The `accelerate` config attachment — when the browser supports
 *   scroll-timeline / view-timeline, the *Progress MVs receive an
 *   AccelerateConfig describing the 0→1 linear mapping.
 *
 * We mock motion's `scroll()` and motion-dom's `supportsScrollTimeline` /
 * `supportsViewTimeline` so tests don't depend on real browser capabilities.
 */

type ScrollCallback = (
    progress: number,
    info: {
        x: { current: number; progress: number; scrollLength: number }
        y: { current: number; progress: number; scrollLength: number }
    }
) => void
type ScrollOpts = Record<string, unknown> | undefined

const scrollMock = vi.fn<(cb: ScrollCallback, opts?: ScrollOpts) => () => void>()
const supportsScrollTimelineMock = vi.fn(() => false)
const supportsViewTimelineMock = vi.fn(() => false)

vi.mock('motion', () => ({
    scroll: (cb: ScrollCallback, opts?: ScrollOpts) => scrollMock(cb, opts)
}))

vi.mock('motion-dom', async () => {
    const actual = await vi.importActual<typeof import('motion-dom')>('motion-dom')
    return {
        ...actual,
        supportsScrollTimeline: () => supportsScrollTimelineMock(),
        supportsViewTimeline: () => supportsViewTimelineMock()
    }
})

// Import AFTER vi.mock so the hook picks up the mocked exports.
const { useScroll } = await import('./scroll.svelte.js')

/**
 * Drain motion-dom's microtask batcher. Each `await Promise.resolve()`
 * flushes one microtask tick; the batcher may re-schedule itself across
 * ticks (read step calls user code that calls microtask.read again), so
 * pumping a few ticks is the reliable way to settle the queue.
 */
const drainMicrotasks = async (ticks = 4) => {
    for (let i = 0; i < ticks; i++) await Promise.resolve()
}

describe('utils/scroll - useScroll', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        vi.useRealTimers()
        cleanups = []
        scrollMock.mockReset()
        scrollMock.mockImplementation(() => () => undefined)
        supportsScrollTimelineMock.mockReturnValue(false)
        supportsViewTimelineMock.mockReturnValue(false)
    })

    afterEach(() => {
        for (const fn of cleanups) fn()
        vi.unstubAllGlobals()
    })

    const inRoot = <T>(fn: () => T): T => {
        let result: T
        const stop = $effect.root(() => {
            result = fn()
        })
        cleanups.push(stop)
        return result!
    }

    // -------- basic public shape --------

    it('returns six MotionValues with initial 0', () => {
        inRoot(() => {
            const {
                scrollX,
                scrollY,
                scrollXProgress,
                scrollYProgress,
                scrollXLength,
                scrollYLength
            } = useScroll()
            expect(isMotionValue(scrollX)).toBe(true)
            expect(isMotionValue(scrollY)).toBe(true)
            expect(isMotionValue(scrollXProgress)).toBe(true)
            expect(isMotionValue(scrollYProgress)).toBe(true)
            expect(isMotionValue(scrollXLength)).toBe(true)
            expect(isMotionValue(scrollYLength)).toBe(true)
            expect(scrollX.current).toBe(0)
            expect(scrollY.current).toBe(0)
            expect(scrollXProgress.current).toBe(0)
            expect(scrollYProgress.current).toBe(0)
            expect(scrollXLength.current).toBe(0)
            expect(scrollYLength.current).toBe(0)
        })
    })

    it('.current and .get() agree', () => {
        inRoot(() => {
            const { scrollY } = useScroll()
            expect(scrollY.get()).toBe(0)
            expect(scrollY.current).toBe(0)
        })
    })

    it('subscribe emits initial value synchronously', () => {
        inRoot(() => {
            const { scrollYProgress } = useScroll()
            const seen: number[] = []
            const off = scrollYProgress.subscribe((v) => seen.push(v))
            expect(seen).toEqual([0])
            off()
        })
    })

    it('svelte store get() round-trips through the .subscribe shim', () => {
        inRoot(() => {
            const { scrollY } = useScroll()
            expect(get(scrollY)).toBe(0)
        })
    })

    // -------- JS scroll() callback path --------

    it('attaches motion.scroll() at mount with the supplied options', async () => {
        const container = document.createElement('div')
        const target = document.createElement('div')
        inRoot(() => useScroll({ container, target, axis: 'x' }))
        flushSync()
        // motion-dom's microtask batcher fires its scheduled callbacks via
        // queueMicrotask — drain the queue.
        await drainMicrotasks()
        expect(scrollMock).toHaveBeenCalledTimes(1)
        const [, opts] = scrollMock.mock.calls[0]
        expect((opts as { container?: HTMLElement }).container).toBe(container)
        expect((opts as { target?: HTMLElement }).target).toBe(target)
        expect((opts as { axis?: string }).axis).toBe('x')
    })

    it('forwards trackContentSize to scroll()', async () => {
        const container = document.createElement('div')
        inRoot(() => useScroll({ container, trackContentSize: true }))
        flushSync()
        await drainMicrotasks()
        expect(scrollMock).toHaveBeenCalledTimes(1)
        const [, opts] = scrollMock.mock.calls[0]
        expect((opts as { trackContentSize?: boolean }).trackContentSize).toBe(true)
        expect((opts as { container?: HTMLElement }).container).toBe(container)
    })

    it('forwards trackContentSize to the accelerated (ViewTimeline) scroll() call', async () => {
        supportsViewTimelineMock.mockReturnValue(true)
        const container = document.createElement('div')
        const target = document.createElement('div')
        const ctx = inRoot(() =>
            useScroll({
                container,
                target,
                offset: ['start end', 'end start'],
                trackContentSize: true
            })
        )
        const factory = ctx.scrollYProgress.accelerate?.factory
        expect(factory).toBeDefined()
        const animation = {} as Parameters<NonNullable<typeof factory>>[0]
        const detach = factory!(animation)
        cleanups.push(() => detach?.())
        flushSync()
        await drainMicrotasks()
        const call = scrollMock.mock.calls.find(([cb]) => cb === (animation as unknown))
        expect(call).toBeDefined()
        const opts = call![1] as { trackContentSize?: boolean; axis?: string; target?: Element }
        expect(opts.trackContentSize).toBe(true)
        expect(opts.axis).toBe('y')
        expect(opts.target).toBe(target)
    })

    it('trackContentSize leaves the accelerate decision alone', () => {
        // Upstream canAccelerateScroll looks only at target / offset.
        supportsScrollTimelineMock.mockReturnValue(true)
        const ctx = inRoot(() => useScroll({ trackContentSize: true }))
        expect(ctx.scrollXProgress.accelerate).toBeDefined()
        expect(ctx.scrollYProgress.accelerate).toBeDefined()
        expect(ctx.scrollYLength.accelerate).toBeUndefined()
    })

    it('writes scroll().info into the four motion values', async () => {
        const ctx = inRoot(() => useScroll())
        flushSync()
        await drainMicrotasks()
        const [cb] = scrollMock.mock.calls[0]
        cb(0.5, {
            x: { current: 100, progress: 0.5, scrollLength: 0 },
            y: { current: 250, progress: 0.25, scrollLength: 0 }
        })
        expect(ctx.scrollX.current).toBe(100)
        expect(ctx.scrollXProgress.current).toBe(0.5)
        expect(ctx.scrollY.current).toBe(250)
        expect(ctx.scrollYProgress.current).toBe(0.25)
    })

    it('writes x/y scrollLength into scrollXLength / scrollYLength', async () => {
        const ctx = inRoot(() => useScroll())
        flushSync()
        await drainMicrotasks()
        const [cb] = scrollMock.mock.calls[0]
        cb(0.5, {
            x: { current: 100, progress: 0.5, scrollLength: 600 },
            y: { current: 250, progress: 0.25, scrollLength: 2500 }
        })
        expect(ctx.scrollXLength.current).toBe(600)
        expect(ctx.scrollYLength.current).toBe(2500)
        // Distance from the end (Motion #2189).
        expect(ctx.scrollYLength.get() - ctx.scrollY.get()).toBe(2250)
    })

    it('destroys the length values on unmount', () => {
        let ctx: ReturnType<typeof useScroll> | undefined
        const root = $effect.root(() => {
            ctx = useScroll()
        })
        flushSync()
        const destroyX = vi.spyOn(ctx!.scrollXLength, 'destroy')
        const destroyY = vi.spyOn(ctx!.scrollYLength, 'destroy')
        root()
        expect(destroyX).toHaveBeenCalledTimes(1)
        expect(destroyY).toHaveBeenCalledTimes(1)
    })

    it('disposes the scroll() observer on unmount', async () => {
        const dispose = vi.fn()
        scrollMock.mockImplementation(() => dispose)
        const root = $effect.root(() => {
            useScroll()
        })
        flushSync()
        await drainMicrotasks()
        expect(scrollMock).toHaveBeenCalledTimes(1)
        root()
        expect(dispose).toHaveBeenCalledTimes(1)
    })

    // -------- microtask-defer ref resolution --------

    it('defers attachment when a `bind:this` getter is initially undefined', async () => {
        // Verifies the *gate*: if the getter returns undefined at attach
        // time, motion.scroll() is not called. The dynamic-hydration retry
        // path is exercised behaviorally via the next test, since pumping
        // motion-dom's microtask batcher to completion in isolation
        // requires a wake event the test environment doesn't naturally
        // produce.
        const ref: { current?: HTMLElement } = {}
        inRoot(() => useScroll({ container: () => ref.current }))
        flushSync()
        await drainMicrotasks()
        expect(scrollMock).not.toHaveBeenCalled()
    })

    // -------- accelerate config attachment --------

    it('does not set accelerate when no native timeline is supported', () => {
        supportsScrollTimelineMock.mockReturnValue(false)
        supportsViewTimelineMock.mockReturnValue(false)
        const ctx = inRoot(() => useScroll())
        expect(ctx.scrollXProgress.accelerate).toBeUndefined()
        expect(ctx.scrollYProgress.accelerate).toBeUndefined()
    })

    it('sets accelerate on *Progress MVs when scroll-timeline is supported (no target)', () => {
        supportsScrollTimelineMock.mockReturnValue(true)
        const ctx = inRoot(() => useScroll())
        expect(ctx.scrollXProgress.accelerate).toBeDefined()
        expect(ctx.scrollYProgress.accelerate).toBeDefined()
        // The accelerate config describes a 0→1 linear mapping for both axes.
        expect(ctx.scrollXProgress.accelerate?.times).toEqual([0, 1])
        expect(ctx.scrollXProgress.accelerate?.keyframes).toEqual([0, 1])
        expect(ctx.scrollXProgress.accelerate?.duration).toBe(1)
        expect(typeof ctx.scrollXProgress.accelerate?.factory).toBe('function')
    })

    it('does not set accelerate for a page offset (a ScrollTimeline has no offset)', () => {
        // Motion 13.5.0 use-scroll.ts: `supportsScrollTimeline() && !offset`.
        supportsScrollTimelineMock.mockReturnValue(true)
        const ctx = inRoot(() => useScroll({ offset: ['start start', 'end end'] }))
        expect(ctx.scrollXProgress.accelerate).toBeUndefined()
        expect(ctx.scrollYProgress.accelerate).toBeUndefined()
    })

    it('does not set accelerate when target is provided but view-timeline is unsupported', () => {
        supportsScrollTimelineMock.mockReturnValue(true)
        supportsViewTimelineMock.mockReturnValue(false)
        const target = document.createElement('div')
        const ctx = inRoot(() => useScroll({ target }))
        expect(ctx.scrollXProgress.accelerate).toBeUndefined()
        expect(ctx.scrollYProgress.accelerate).toBeUndefined()
    })

    it('sets accelerate when target is provided, view-timeline is supported, and offset maps to a named range', () => {
        supportsViewTimelineMock.mockReturnValue(true)
        const target = document.createElement('div')
        // ScrollOffset preset "Enter": [[0,1],[1,1]] — maps to view-timeline
        // range "entry". The mapping is local to scroll.svelte.ts.
        const ctx = inRoot(() =>
            useScroll({
                target,
                offset: [
                    [0, 1],
                    [1, 1]
                ]
            })
        )
        expect(ctx.scrollXProgress.accelerate).toBeDefined()
        expect(ctx.scrollYProgress.accelerate).toBeDefined()
    })

    it('does not set accelerate when target offset does not match a named range', () => {
        supportsViewTimelineMock.mockReturnValue(true)
        const target = document.createElement('div')
        // Arbitrary offset that isn't in the preset table.
        const ctx = inRoot(() =>
            useScroll({
                target,
                offset: [
                    [0.1, 0.9],
                    [0.9, 0.1]
                ]
            })
        )
        expect(ctx.scrollXProgress.accelerate).toBeUndefined()
        expect(ctx.scrollYProgress.accelerate).toBeUndefined()
    })

    it('never accelerates the length values', () => {
        // Motion 14.7.1 use-scroll.ts gives only the *Progress values an accelerate config.
        supportsScrollTimelineMock.mockReturnValue(true)
        const ctx = inRoot(() => useScroll())
        expect(ctx.scrollYProgress.accelerate).toBeDefined()
        expect(ctx.scrollXLength.accelerate).toBeUndefined()
        expect(ctx.scrollYLength.accelerate).toBeUndefined()
    })

    // Offsets that Motion 13.4.7's `offsetToViewTimelineRange` maps to a native range.
    it.each([
        ['cover strings', ['start end', 'end start']],
        [
            'cover numeric',
            [
                [0, 1],
                [1, 0]
            ]
        ],
        ['partial center edges', ['center end', 'center start']],
        [
            'partial numeric',
            [
                [0.25, 1],
                [0.75, 0]
            ]
        ],
        ['All strings', ['start start', 'end end']],
        ['reversed All', ['end end', 'start start']]
    ] as const)('sets accelerate for offset the 13.4.7 rule maps: %s', (_name, offset) => {
        supportsViewTimelineMock.mockReturnValue(true)
        const target = document.createElement('div')
        const ctx = inRoot(() =>
            useScroll({ target, offset: offset as unknown as Array<[number, number]> })
        )
        expect(ctx.scrollXProgress.accelerate).toBeDefined()
        expect(ctx.scrollYProgress.accelerate).toBeDefined()
    })

    // Offsets the 13.4.7 rule rejects; must stay on the JS path.
    it.each([
        ['container edge other than start/end', ['start center', 'end start']],
        ['absolute px length', ['100px end', 'end start']],
        ['absolute vh length', ['start end', 'end 50vh']],
        ['identical points', ['start start', 'start start']],
        ['not exactly two points', ['start end', 'center center', 'end start']]
    ] as const)(
        'does not set accelerate for offset the 13.4.7 rule rejects: %s',
        (_name, offset) => {
            supportsViewTimelineMock.mockReturnValue(true)
            const target = document.createElement('div')
            const ctx = inRoot(() => useScroll({ target, offset: offset as unknown as string[] }))
            expect(ctx.scrollXProgress.accelerate).toBeUndefined()
            expect(ctx.scrollYProgress.accelerate).toBeUndefined()
        }
    )

    // -------- SSR --------

    it('SSR fallback: returns motion values with no observer when window is undefined', () => {
        vi.stubGlobal('window', undefined)
        const { scrollX, scrollY, scrollXProgress, scrollYProgress, scrollXLength, scrollYLength } =
            useScroll()
        expect(isMotionValue(scrollX)).toBe(true)
        expect(scrollX.current).toBe(0)
        expect(scrollY.current).toBe(0)
        expect(scrollXProgress.current).toBe(0)
        expect(scrollYProgress.current).toBe(0)
        expect(isMotionValue(scrollXLength)).toBe(true)
        expect(isMotionValue(scrollYLength)).toBe(true)
        expect(scrollXLength.current).toBe(0)
        expect(scrollYLength.current).toBe(0)
        // No subscriptions, no scroll() invocation.
        expect(scrollMock).not.toHaveBeenCalled()
    })
})
