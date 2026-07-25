import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockIntersectionObserver } from './__tests__/intersectionObserver.js'
import { useInView } from './inView.svelte.js'

vi.mock(import('motion'), async (importOriginal) => {
    const actual = await importOriginal()
    return {
        ...actual,
        animate: vi.fn(() => ({ finished: Promise.resolve() })) as never
    }
})

let io: ReturnType<typeof createMockIntersectionObserver>

beforeEach(() => {
    io = createMockIntersectionObserver()
    vi.stubGlobal('IntersectionObserver', io.Class)
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('useInView', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        cleanups = []
    })

    afterEach(() => {
        for (const fn of cleanups) fn()
    })

    const inRoot = <T>(fn: () => T): { result: T; unmount: VoidFunction } => {
        let result: T
        const stop = $effect.root(() => {
            result = fn()
        })
        cleanups.push(stop)
        return { result: result!, unmount: stop }
    }

    it('.current starts at the initial value (default false)', () => {
        const { result: state } = inRoot(() => useInView(document.createElement('div')))
        expect(state.current).toBe(false)
    })

    it('honors initial: true before the first IntersectionObserver callback', () => {
        const { result: state } = inRoot(() =>
            useInView(document.createElement('div'), { initial: true })
        )
        expect(state.current).toBe(true)
    })

    it('.current flips to true on enter and back to false on exit', () => {
        const el = document.createElement('div')
        const { result: state } = inRoot(() => useInView(el))
        flushSync()
        const seen: boolean[] = []
        const off = state.subscribe((v) => seen.push(v))
        io.fireOn(el, true)
        io.fireOn(el, false)
        off()
        expect(seen).toEqual([false, true, false])
    })

    it('latches on first enter when once: true and stops observing', () => {
        const el = document.createElement('div')
        const { result: state } = inRoot(() => useInView(el, { once: true }))
        flushSync()
        io.fireOn(el, true)
        expect(state.current).toBe(true)
        const obs = io.instances()[0]
        expect(obs.unobserve).toHaveBeenCalledWith(el)
        // Subsequent events are no-ops; the state stays true.
        io.fireOn(el, false)
        expect(state.current).toBe(true)
    })

    it('shares one observer across multiple .subscribe callers', () => {
        const el = document.createElement('div')
        const { result: state } = inRoot(() => useInView(el))
        flushSync()
        const offA = state.subscribe(() => {})
        const offB = state.subscribe(() => {})
        expect(io.instances().length).toBe(1)
        // Individual unsubs don't tear down the observer — lifecycle is
        // tied to the component scope, not subscriber refcount.
        offA()
        offB()
        const obs = io.instances()[0]
        expect(obs.disconnect).not.toHaveBeenCalled()
    })

    it('disconnects the observer on unmount', () => {
        const el = document.createElement('div')
        const { result: state, unmount } = inRoot(() => useInView(el))
        flushSync()
        const off = state.subscribe(() => {})
        expect(io.instances().length).toBe(1)
        off()
        unmount()
        const obs = io.instances()[0]
        expect(obs.disconnect).toHaveBeenCalledTimes(1)
    })

    it('defers attachment until a `bind:this` getter hydrates', async () => {
        // createAttachable now schedules its retry via motion-dom's
        // `microtask.read` (instead of rAF), so this verifies the same
        // behavior end-to-end: no observer attached while the getter
        // returns undefined; once the ref hydrates, the next microtask
        // tick attaches.
        const el = document.createElement('div')
        const ref: { current?: HTMLElement } = {}
        inRoot(() => useInView(() => ref.current))
        flushSync()
        expect(io.instances().length).toBe(0)

        ref.current = el
        // Let the microtask retry fire.
        await Promise.resolve()
        // Schedule a render-frame to be safe — `microtask.read` may need a
        // batcher tick depending on whether motion-dom has woken its loop.
        await new Promise<void>((resolve) => queueMicrotask(resolve))
        expect(io.instances().length).toBe(1)
    })

    it('falls back to static state when IntersectionObserver is unavailable', () => {
        vi.stubGlobal('IntersectionObserver', undefined)
        const { result: state } = inRoot(() =>
            useInView(document.createElement('div'), { initial: true })
        )
        expect(state.current).toBe(true)
        state.subscribe(() => {})()
        expect(io.instances().length).toBe(0)
    })

    it('SSR-safe (no window)', () => {
        vi.stubGlobal('window', undefined)
        const { result: state } = inRoot(() => useInView(document.createElement('div')))
        expect(state.current).toBe(false)
        state.subscribe(() => {})()
        expect(io.instances().length).toBe(0)
    })

    it('forwards a custom root element to IntersectionObserver', () => {
        const target = document.createElement('div')
        const root = document.createElement('section')
        inRoot(() => useInView(target, { root }))
        flushSync()
        expect(io.instances()[0].init?.root).toBe(root)
    })

    it('forwards margin to IntersectionObserver as rootMargin', () => {
        const target = document.createElement('div')
        inRoot(() => useInView(target, { margin: '20px 0px 40px 0px' }))
        flushSync()
        expect(io.instances()[0].init?.rootMargin).toBe('20px 0px 40px 0px')
    })

    it('translates amount: number to threshold', () => {
        const target = document.createElement('div')
        inRoot(() => useInView(target, { amount: 0.5 }))
        flushSync()
        expect(io.instances()[0].init?.threshold).toBe(0.5)
    })

    it('translates amount: "all" to threshold 1', () => {
        const target = document.createElement('div')
        inRoot(() => useInView(target, { amount: 'all' }))
        flushSync()
        expect(io.instances()[0].init?.threshold).toBe(1)
    })
})
