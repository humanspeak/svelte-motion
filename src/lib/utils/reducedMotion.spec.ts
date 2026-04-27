import { get } from 'svelte/store'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReducedMotion } from './reducedMotion.js'

type ChangeHandler = (event: MediaQueryListEvent) => void

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

describe('utils/reducedMotion - useReducedMotion', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('reflects the initial matchMedia result', () => {
        const { mql } = createMediaQueryList(true)
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => mql)
        )

        const store = useReducedMotion()
        expect(get(store)).toBe(true)
    })

    it('updates when the media query changes', () => {
        const { mql, emit } = createMediaQueryList(false)
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => mql)
        )

        const store = useReducedMotion()
        const seen: boolean[] = []
        const unsub = store.subscribe((value) => seen.push(value))

        emit(true)
        emit(false)

        expect(seen).toEqual([false, true, false])
        unsub()
    })

    it('removes the listener on unsubscribe', () => {
        const { mql, listenerCount } = createMediaQueryList(false)
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => mql)
        )

        const store = useReducedMotion()
        const unsub = store.subscribe(() => {})

        expect(listenerCount()).toBe(1)
        expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

        unsub()

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

        const store = useReducedMotion()
        const seen: boolean[] = []
        const unsub = store.subscribe((value) => seen.push(value))

        emit(true)
        expect(seen).toEqual([false, true])
        expect(mql.addListener).toHaveBeenCalled()

        unsub()
        expect(listenerCount()).toBe(0)
        expect(mql.removeListener).toHaveBeenCalled()
    })

    it('returns false when matchMedia throws', () => {
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => {
                throw new Error('matchMedia not supported')
            })
        )

        const store = useReducedMotion()
        expect(get(store)).toBe(false)
    })

    it('is SSR-safe (no window)', () => {
        vi.stubGlobal('window', undefined)
        const store = useReducedMotion()
        expect(get(store)).toBe(false)
    })
})
