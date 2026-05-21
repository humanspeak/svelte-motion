import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReducedMotion } from './reducedMotion.svelte.js'

type ChangeHandler = (event: MediaQueryListEvent) => void

/**
 * Build a fake `MediaQueryList` whose listeners we can inspect and
 * fire synchronously. Mirrors the helper from the old store-based spec
 * so the underlying coverage stays the same.
 */
const createMediaQueryList = (initialMatches: boolean) => {
    const listeners = new Set<ChangeHandler>()
    const mql = {
        matches: initialMatches,
        addEventListener: vi.fn((event: string, cb: ChangeHandler) => {
            if (event === 'change') listeners.add(cb)
        }),
        removeEventListener: vi.fn((event: string, cb: ChangeHandler) => {
            if (event === 'change') listeners.delete(cb)
        }),
        addListener: vi.fn((cb: ChangeHandler) => listeners.add(cb)),
        removeListener: vi.fn((cb: ChangeHandler) => listeners.delete(cb))
    }
    return {
        mql,
        emit: (matches: boolean) => {
            mql.matches = matches
            const event = { matches } as MediaQueryListEvent
            for (const listener of listeners) listener(event)
        },
        listenerCount: () => listeners.size
    }
}

/**
 * `$effect` requires a reactive scope, so every test wraps work in
 * `$effect.root` and captures the cleanup function so we can simulate
 * an unmount and verify the media listener is released.
 */
describe('useReducedMotion', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        cleanups = []
    })

    afterEach(() => {
        for (const fn of cleanups) fn()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    const inRoot = <T>(fn: () => T): { result: T; unmount: VoidFunction } => {
        let result: T
        const stop = $effect.root(() => {
            result = fn()
        })
        cleanups.push(stop)
        return { result: result!, unmount: stop }
    }

    it('reflects the initial matchMedia result via .current', () => {
        const { mql } = createMediaQueryList(true)
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => mql)
        )

        const { result: state } = inRoot(() => useReducedMotion())
        expect(state.current).toBe(true)
    })

    it('.current updates when the media query changes', () => {
        const { mql, emit } = createMediaQueryList(false)
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => mql)
        )

        const { result: state } = inRoot(() => useReducedMotion())
        flushSync() // run $effect to wire the media listener
        expect(state.current).toBe(false)
        emit(true)
        expect(state.current).toBe(true)
        emit(false)
        expect(state.current).toBe(false)
    })

    it('.subscribe(run) emits initial value synchronously then on every change', () => {
        const { mql, emit } = createMediaQueryList(false)
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => mql)
        )

        const seen: boolean[] = []
        const { result: state } = inRoot(() => useReducedMotion())
        flushSync()
        const off = state.subscribe((value) => seen.push(value))
        emit(true)
        emit(false)
        off()
        expect(seen).toEqual([false, true, false])
    })

    it('detaches the media listener on unmount', () => {
        const { mql, listenerCount } = createMediaQueryList(false)
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => mql)
        )

        const { unmount } = inRoot(() => useReducedMotion())
        flushSync()
        expect(listenerCount()).toBe(1)
        expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
        unmount()
        expect(listenerCount()).toBe(0)
        expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('falls back to addListener/removeListener when addEventListener is unavailable', () => {
        const { mql, emit, listenerCount } = createMediaQueryList(false)
        delete (mql as Partial<typeof mql>).addEventListener
        delete (mql as Partial<typeof mql>).removeEventListener

        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => mql)
        )

        const seen: boolean[] = []
        const { result: state, unmount } = inRoot(() => useReducedMotion())
        flushSync()
        const off = state.subscribe((value) => seen.push(value))
        emit(true)
        expect(seen).toEqual([false, true])
        expect(mql.addListener).toHaveBeenCalled()
        off()
        unmount()
        expect(listenerCount()).toBe(0)
        expect(mql.removeListener).toHaveBeenCalled()
    })

    it('.current is false when matchMedia throws', () => {
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => {
                throw new Error('matchMedia not supported')
            })
        )
        const { result: state } = inRoot(() => useReducedMotion())
        expect(state.current).toBe(false)
    })

    it('SSR-safe: returns static state with .current=false when window is missing', () => {
        vi.stubGlobal('window', undefined)
        const { result: state } = inRoot(() => useReducedMotion())
        expect(state.current).toBe(false)
        // Subscribe still emits the static value synchronously so consumers
        // can wire the SSR path identically to the live path.
        const seen: boolean[] = []
        const off = state.subscribe((v) => seen.push(v))
        expect(seen).toEqual([false])
        off()
    })
})
