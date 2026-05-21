import { isMotionValue, motionValue } from 'motion-dom'
import { flushSync } from 'svelte'
import { get, writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpring } from './spring.svelte.js'

/**
 * `useSpring` is now built on motion-dom's MotionValue + attachFollow, so we
 * don't re-test spring physics — motion-dom owns that. These tests cover the
 * Svelte 5 / svelte-store compatibility layer we add on top: MotionValue
 * identity, `.current` reactivity, `.subscribe` shim, source-follow paths,
 * and SSR safety.
 *
 * `$effect(() => () => destroy())` requires a reactive scope, so every test
 * that exercises the client-side path runs inside `$effect.root`.
 */
describe('utils/spring - useSpring', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        cleanups = []
    })

    afterEach(() => {
        for (const fn of cleanups) fn()
        vi.restoreAllMocks()
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

    it('returns a real MotionValue (isMotionValue passes)', () => {
        inRoot(() => {
            const s = useSpring(0)
            expect(isMotionValue(s)).toBe(true)
        })
    })

    it('reads initial value via .get(), .current, and svelte get()', () => {
        inRoot(() => {
            const s = useSpring(42)
            expect(s.get()).toBe(42)
            expect(s.current).toBe(42)
            expect(get(s)).toBe(42)
        })
    })

    it('jump sets immediately without animation', () => {
        inRoot(() => {
            const s = useSpring(0)
            s.jump(50)
            expect(s.get()).toBe(50)
            expect(s.current).toBe(50)
        })
    })

    it('jump preserves unit on string inputs', () => {
        inRoot(() => {
            const s = useSpring('10vh')
            s.jump('20vh')
            expect(s.get()).toBe('20vh')
        })
    })

    it('emits via .on("change") when value moves', () => {
        inRoot(() => {
            const s = useSpring(0)
            const seen: number[] = []
            const off = s.on('change', (v) => seen.push(v))
            s.jump(10)
            expect(seen).toEqual([10])
            off()
        })
    })

    it('.subscribe(run) emits initial value synchronously then on change', () => {
        inRoot(() => {
            const s = useSpring(7)
            const seen: number[] = []
            const off = s.subscribe((v) => seen.push(v))
            expect(seen).toEqual([7])
            s.jump(9)
            expect(seen).toEqual([7, 9])
            off()
        })
    })

    it('svelte store get() round-trips through .subscribe', () => {
        inRoot(() => {
            const s = useSpring(0)
            s.jump(123)
            expect(get(s)).toBe(123)
        })
    })

    it('.set does not jump — value stays at start until frame loop runs', () => {
        inRoot(() => {
            const s = useSpring(0, { stiffness: 1000, damping: 50 })
            s.set(100)
            expect(s.get()).toBe(0)
        })
    })

    it('accepts a motion-dom MotionValue source', () => {
        inRoot(() => {
            const src = motionValue(0)
            const s = useSpring(src)
            expect(s.get()).toBe(0)
            expect(isMotionValue(s)).toBe(true)
        })
    })

    it('accepts a Svelte readable source (backwards compat)', () => {
        inRoot(() => {
            const src = writable<number | string>(0)
            const s = useSpring(src)
            expect(s.get()).toBe(0)
            expect(isMotionValue(s)).toBe(true)
        })
    })

    it('.destroy() tears down listeners and stops following', () => {
        inRoot(() => {
            const src = motionValue(0)
            const s = useSpring(src)
            expect(s.get()).toBe(0)
            s.destroy()
            src.set(100)
            expect(s.get()).toBe(0)
        })
    })

    it('.current updates reactively after jump', () => {
        const seen: Array<number | string> = []
        inRoot(() => {
            const s = useSpring(0)
            $effect(() => {
                seen.push(s.current)
            })
            // Flush so the effect runs and captures the initial value before
            // we mutate. Each jump is followed by another flush so the
            // tracking effect re-runs synchronously inside the test.
            flushSync()
            s.jump(1)
            flushSync()
            s.jump(2)
            flushSync()
        })
        expect(seen).toEqual([0, 1, 2])
    })

    it('SSR-safe: returns static MotionValue with no-op setters', () => {
        vi.stubGlobal('window', undefined)
        inRoot(() => {
            const s = useSpring(0)
            expect(s.get()).toBe(0)
            expect(s.current).toBe(0)
            s.set(100)
            expect(s.get()).toBe(0)
            s.jump(200)
            expect(s.get()).toBe(0)
        })
    })
})
