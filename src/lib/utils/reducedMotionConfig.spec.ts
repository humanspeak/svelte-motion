import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/components/motionConfig.context', () => ({
    getMotionConfig: vi.fn()
}))

import { getMotionConfig } from '$lib/components/motionConfig.context'
import { filterReducedMotionKeyframes, useReducedMotionConfig } from './reducedMotionConfig.js'

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

describe('utils/reducedMotionConfig - filterReducedMotionKeyframes', () => {
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

describe('utils/reducedMotionConfig - useReducedMotionConfig', () => {
    beforeEach(() => {
        mockedGetMotionConfig.mockReset()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it("returns true when policy is 'always'", () => {
        mockedGetMotionConfig.mockReturnValue({ reducedMotion: 'always' })
        const store = useReducedMotionConfig()
        expect(get(store)).toBe(true)
    })

    it("returns false when policy is 'never'", () => {
        mockedGetMotionConfig.mockReturnValue({ reducedMotion: 'never' })
        const store = useReducedMotionConfig()
        expect(get(store)).toBe(false)
    })

    it("returns false when no MotionConfig ancestor (defaults to 'never')", () => {
        mockedGetMotionConfig.mockReturnValue(undefined)
        const store = useReducedMotionConfig()
        expect(get(store)).toBe(false)
    })

    it("mirrors OS preference when policy is 'user'", () => {
        const { mql } = createMediaQueryList(true)
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => mql)
        )
        mockedGetMotionConfig.mockReturnValue({ reducedMotion: 'user' })
        const store = useReducedMotionConfig()
        expect(get(store)).toBe(true)
    })

    it("updates reactively when OS preference changes under 'user' policy", () => {
        const { mql, emit } = createMediaQueryList(false)
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => mql)
        )
        mockedGetMotionConfig.mockReturnValue({ reducedMotion: 'user' })
        const store = useReducedMotionConfig()
        const seen: boolean[] = []
        const unsub = store.subscribe((value) => seen.push(value))

        emit(true)
        emit(false)

        expect(seen).toEqual([false, true, false])
        unsub()
    })

    it('is SSR-safe when policy is user and no matchMedia', () => {
        vi.stubGlobal('window', undefined)
        mockedGetMotionConfig.mockReturnValue({ reducedMotion: 'user' })
        const store = useReducedMotionConfig()
        expect(get(store)).toBe(false)
    })
})
