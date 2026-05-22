import { frame, isMotionValue, motionValue } from 'motion-dom'
import { flushSync } from 'svelte'
import { get, writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFollowValue } from './followValue.svelte.js'

/** Gate the next assertion on motion-dom's render tick — `attachFollow`
 *  schedules updates via `frame.update`, so we need to wait for the
 *  scheduler to flush before reading `.get()`. */
const nextFrame = () =>
    new Promise<void>((resolve) => {
        frame.render(() => resolve())
    })

/** Poll up to `max` frames until `predicate` is satisfied. Used to wait
 *  out the subscribe → animation-kickoff hop that lives between
 *  `source.set(...)` and the follower's first updated value. */
const waitFor = async (predicate: () => boolean, max = 20): Promise<void> => {
    for (let i = 0; i < max; i++) {
        if (predicate()) return
        await nextFrame()
    }
    throw new Error('waitFor: predicate never became truthy')
}

/**
 * `useFollowValue` is the generalised follow hook that `useSpring` wraps with
 * a `type: 'spring'` default. The animation physics themselves are owned by
 * motion-dom's `attachFollow` / `JSAnimation` and tested upstream. These tests
 * cover the Svelte 5 augmentation layer: MotionValue identity, `.current`
 * reactivity, `.subscribe` shim, source-follow paths (number / string /
 * MotionValue / Readable), and SSR safety. Transition-type coverage stays
 * thin — we verify each accepted shape attaches without throwing rather than
 * re-testing motion-dom's tween / spring / inertia internals.
 */
describe('utils/followValue - useFollowValue', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        vi.useRealTimers()
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
            const v = useFollowValue(0)
            expect(isMotionValue(v)).toBe(true)
        })
    })

    it('reads initial value via .get(), .current, and svelte get()', () => {
        inRoot(() => {
            const v = useFollowValue(42)
            expect(v.get()).toBe(42)
            expect(v.current).toBe(42)
            expect(get(v)).toBe(42)
        })
    })

    it('jump sets immediately without animation', () => {
        inRoot(() => {
            const v = useFollowValue(0)
            v.jump(50)
            expect(v.get()).toBe(50)
            expect(v.current).toBe(50)
        })
    })

    it('jump preserves unit on string inputs', () => {
        inRoot(() => {
            const v = useFollowValue('10vh')
            v.jump('20vh')
            expect(v.get()).toBe('20vh')
        })
    })

    it('.subscribe emits initial value synchronously then on change', () => {
        inRoot(() => {
            const v = useFollowValue(7)
            const seen: number[] = []
            const off = v.subscribe((x) => seen.push(x))
            expect(seen).toEqual([7])
            v.jump(9)
            expect(seen).toEqual([7, 9])
            off()
        })
    })

    it('accepts a motion-dom MotionValue source (spring default)', () => {
        inRoot(() => {
            const src = motionValue(0)
            const v = useFollowValue(src)
            expect(v.get()).toBe(0)
            expect(isMotionValue(v)).toBe(true)
        })
    })

    it('accepts a Svelte readable source via the internal bridge', () => {
        inRoot(() => {
            const src = writable<number>(0)
            const v = useFollowValue(src)
            expect(v.get()).toBe(0)
            expect(isMotionValue(v)).toBe(true)
        })
    })

    it('accepts `type: "tween"` options without throwing', () => {
        inRoot(() => {
            const v = useFollowValue(0, { type: 'tween', duration: 0.3, ease: 'easeOut' })
            expect(isMotionValue(v)).toBe(true)
            expect(v.current).toBe(0)
        })
    })

    it('accepts `type: "inertia"` options without throwing', () => {
        inRoot(() => {
            const v = useFollowValue(0, { type: 'inertia', velocity: 500, power: 0.6 })
            expect(isMotionValue(v)).toBe(true)
        })
    })

    it('accepts `type: "spring"` options (explicit form matching useSpring)', () => {
        inRoot(() => {
            const v = useFollowValue(0, { type: 'spring', stiffness: 200, damping: 20 })
            expect(isMotionValue(v)).toBe(true)
        })
    })

    it('.current updates reactively after jump (effect tracks .current)', () => {
        const seen: Array<number | string> = []
        inRoot(() => {
            const v = useFollowValue(0)
            $effect(() => {
                seen.push(v.current)
            })
            flushSync()
            v.jump(1)
            flushSync()
            v.jump(2)
            flushSync()
        })
        expect(seen).toEqual([0, 1, 2])
    })

    it('SSR-safe: returns static MotionValue with no-op setters', () => {
        vi.stubGlobal('window', undefined)
        inRoot(() => {
            const v = useFollowValue(0, { type: 'spring' })
            expect(v.get()).toBe(0)
            expect(v.current).toBe(0)
            v.set(100)
            expect(v.get()).toBe(0)
            v.jump(200)
            expect(v.get()).toBe(0)
        })
    })

    it('.destroy() tears down listeners and stops following', async () => {
        // Use a zero-duration tween so the follow lands deterministically
        // on the next render frame. A default spring would update
        // asynchronously and the post-destroy assertion could pass even
        // if the follow were still attached, making the test a false
        // positive (CR #376).
        const ctx = inRoot(() => {
            const src = motionValue(0)
            const v = useFollowValue(src, { type: 'tween', duration: 0 })
            return { src, v }
        })
        expect(ctx.v.get()).toBe(0)

        // Prove the follow is wired before tearing it down.
        ctx.src.set(100)
        await waitFor(() => ctx.v.get() === 100)
        expect(ctx.v.get()).toBe(100)

        // Tear down and confirm further source changes don't propagate.
        // Pump a handful of frames so a still-attached animation would
        // have ample opportunity to update.
        ctx.v.destroy()
        ctx.src.set(200)
        for (let i = 0; i < 5; i++) await nextFrame()
        expect(ctx.v.get()).toBe(100)
    })
})
