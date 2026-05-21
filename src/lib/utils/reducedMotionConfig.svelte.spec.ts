import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/components/motionConfig.context', () => ({
    getMotionConfig: vi.fn()
}))

import { getMotionConfig } from '$lib/components/motionConfig.context'
import {
    filterReducedMotionKeyframes,
    useReducedMotionConfig
} from './reducedMotionConfig.svelte.js'

const mockedGetMotionConfig = vi.mocked(getMotionConfig)

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
        }
    }
}

describe('filterReducedMotionKeyframes', () => {
    it('returns input unchanged when reduced is false', () => {
        const input = { x: 100, y: 50, opacity: 1 }
        const out = filterReducedMotionKeyframes(input, false)
        expect(out).toBe(input)
    })

    it('strips transform keys when reduced is true', () => {
        const input = {
            x: 100,
            y: 50,
            translateX: 10,
            scale: 1.5,
            scaleX: 1,
            rotate: 45,
            skewY: 5,
            opacity: 1,
            backgroundColor: '#fff'
        }
        const out = filterReducedMotionKeyframes(input, true)
        expect(out).toEqual({ opacity: 1, backgroundColor: '#fff' })
    })

    it('preserves non-transform keys including transition', () => {
        const input = { x: 1, opacity: 0.5, transition: { duration: 0.3 } }
        const out = filterReducedMotionKeyframes(input, true)
        expect(out).toEqual({ opacity: 0.5, transition: { duration: 0.3 } })
    })

    it('handles undefined input', () => {
        expect(filterReducedMotionKeyframes(undefined, true)).toBeUndefined()
        expect(filterReducedMotionKeyframes(undefined, false)).toBeUndefined()
    })
})

describe('useReducedMotionConfig', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        cleanups = []
        mockedGetMotionConfig.mockReset()
    })

    afterEach(() => {
        for (const fn of cleanups) fn()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    const inRoot = <T>(fn: () => T): T => {
        let result: T
        const stop = $effect.root(() => {
            result = fn()
        })
        cleanups.push(stop)
        return result!
    }

    it("returns true when policy is 'always'", () => {
        mockedGetMotionConfig.mockReturnValue({ reducedMotion: 'always' })
        const state = inRoot(() => useReducedMotionConfig())
        expect(state.current).toBe(true)
    })

    it("returns false when policy is 'never'", () => {
        mockedGetMotionConfig.mockReturnValue({ reducedMotion: 'never' })
        const state = inRoot(() => useReducedMotionConfig())
        expect(state.current).toBe(false)
    })

    it("returns false when no MotionConfig ancestor (defaults to 'never')", () => {
        mockedGetMotionConfig.mockReturnValue(undefined)
        const state = inRoot(() => useReducedMotionConfig())
        expect(state.current).toBe(false)
    })

    it("mirrors OS preference when policy is 'user'", () => {
        const { mql } = createMediaQueryList(true)
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => mql)
        )
        mockedGetMotionConfig.mockReturnValue({ reducedMotion: 'user' })
        const state = inRoot(() => useReducedMotionConfig())
        expect(state.current).toBe(true)
    })

    it("updates reactively when OS preference changes under 'user' policy", () => {
        const { mql, emit } = createMediaQueryList(false)
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => mql)
        )
        mockedGetMotionConfig.mockReturnValue({ reducedMotion: 'user' })

        const state = inRoot(() => useReducedMotionConfig())
        flushSync() // run $effect inside the inner useReducedMotion so the media listener attaches
        const seen: boolean[] = []
        const off = state.subscribe((value) => seen.push(value))
        emit(true)
        emit(false)
        off()
        expect(seen).toEqual([false, true, false])
    })

    it('is SSR-safe when policy is user and no matchMedia', () => {
        vi.stubGlobal('window', undefined)
        mockedGetMotionConfig.mockReturnValue({ reducedMotion: 'user' })
        const state = inRoot(() => useReducedMotionConfig())
        expect(state.current).toBe(false)
    })

    it('.subscribe fires when the MotionConfig policy changes (not only on OS changes)', () => {
        // Simulate a Svelte component prop by backing `.reducedMotion` with a
        // $state cell behind a property getter — same shape as MotionConfig.svelte.
        let policy = $state<'always' | 'never' | 'user'>('never')
        mockedGetMotionConfig.mockReturnValue({
            get reducedMotion() {
                return policy
            }
        })

        const seen: boolean[] = []
        const state = inRoot(() => useReducedMotionConfig())
        flushSync()
        const off = state.subscribe((v) => seen.push(v))
        // Reassign the policy as a parent <MotionConfig> would. The $effect
        // inside the hook should re-evaluate and notify the subscriber even
        // though the OS preference hasn't moved.
        policy = 'always'
        flushSync()
        policy = 'never'
        flushSync()
        off()
        expect(seen).toEqual([false, true, false])
    })
})
