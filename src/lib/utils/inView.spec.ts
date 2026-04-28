import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockIntersectionObserver } from './__tests__/intersectionObserver.js'
import { useInView } from './inView.js'

let io: ReturnType<typeof createMockIntersectionObserver>

beforeEach(() => {
    io = createMockIntersectionObserver()
    vi.stubGlobal('IntersectionObserver', io.Class)
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('utils/inView - useInView', () => {
    it('starts at the initial value (default false)', () => {
        const store = useInView(document.createElement('div'))
        expect(get(store)).toBe(false)
    })

    it('honors initial: true before the first IntersectionObserver callback', () => {
        const store = useInView(document.createElement('div'), { initial: true })
        expect(get(store)).toBe(true)
    })

    it('flips to true on enter and back to false on exit', () => {
        const el = document.createElement('div')
        const store = useInView(el)
        const seen: boolean[] = []
        const unsub = store.subscribe((v) => seen.push(v))

        io.fireOn(el, true)
        io.fireOn(el, false)

        expect(seen).toEqual([false, true, false])
        unsub()
    })

    it('latches on first enter when once: true and stops observing', () => {
        const el = document.createElement('div')
        const store = useInView(el, { once: true })
        const unsub = store.subscribe(() => {})

        io.fireOn(el, true)
        expect(get(store)).toBe(true)

        const obs = io.instances()[0]
        // motion's inView calls observer.unobserve when no onEnd is returned
        expect(obs.unobserve).toHaveBeenCalledWith(el)

        // Subsequent intersection events are no-ops; the store stays true.
        io.fireOn(el, false)
        expect(get(store)).toBe(true)
        unsub()
    })

    it('shares one observer subscription across multiple subscribers', () => {
        const el = document.createElement('div')
        const store = useInView(el)

        const unsubA = store.subscribe(() => {})
        const unsubB = store.subscribe(() => {})

        expect(io.instances().length).toBe(1)

        const obs = io.instances()[0]
        unsubA()
        expect(obs.disconnect).not.toHaveBeenCalled()
        unsubB()
        expect(obs.disconnect).toHaveBeenCalledTimes(1)
    })

    it('polls via requestAnimationFrame when the getter returns undefined', () => {
        const rafCallbacks: FrameRequestCallback[] = []
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn((cb: FrameRequestCallback) => {
                rafCallbacks.push(cb)
                return rafCallbacks.length
            })
        )
        vi.stubGlobal('cancelAnimationFrame', vi.fn())

        const el = document.createElement('div')
        const ref: { current?: HTMLElement } = {}
        const store = useInView(() => ref.current)
        const unsub = store.subscribe(() => {})

        expect(io.instances().length).toBe(0)
        expect(rafCallbacks.length).toBe(1)

        ref.current = el
        rafCallbacks[0]?.(performance.now())

        expect(io.instances().length).toBe(1)
        unsub()
    })

    it('falls back to a static readable when IntersectionObserver is unavailable', () => {
        vi.stubGlobal('IntersectionObserver', undefined)
        const store = useInView(document.createElement('div'), { initial: true })
        expect(get(store)).toBe(true)
        store.subscribe(() => {})()
        expect(io.instances().length).toBe(0)
    })

    it('is SSR-safe (no window)', () => {
        vi.stubGlobal('window', undefined)
        const store = useInView(document.createElement('div'))
        expect(get(store)).toBe(false)
        store.subscribe(() => {})()
        expect(io.instances().length).toBe(0)
    })

    it('forwards a custom root element to IntersectionObserver', () => {
        const target = document.createElement('div')
        const root = document.createElement('section')
        const store = useInView(target, { root })
        const unsub = store.subscribe(() => {})

        expect(io.instances()[0].init?.root).toBe(root)
        unsub()
    })

    it('forwards margin to IntersectionObserver as rootMargin', () => {
        const target = document.createElement('div')
        const store = useInView(target, { margin: '20px 0px 40px 0px' })
        const unsub = store.subscribe(() => {})

        expect(io.instances()[0].init?.rootMargin).toBe('20px 0px 40px 0px')
        unsub()
    })

    it('translates amount: number to threshold', () => {
        const target = document.createElement('div')
        const store = useInView(target, { amount: 0.5 })
        const unsub = store.subscribe(() => {})

        expect(io.instances()[0].init?.threshold).toBe(0.5)
        unsub()
    })

    it('translates amount: "all" to threshold 1', () => {
        const target = document.createElement('div')
        const store = useInView(target, { amount: 'all' })
        const unsub = store.subscribe(() => {})

        expect(io.instances()[0].init?.threshold).toBe(1)
        unsub()
    })
})
