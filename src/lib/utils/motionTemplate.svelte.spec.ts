import { frame, isMotionValue } from 'motion-dom'
import { flushSync } from 'svelte'
import { get, writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMotionTemplate } from './motionTemplate.svelte.js'
import { useMotionValue } from './motionValue.svelte.js'

/**
 * `useMotionTemplate` delegates to motion-dom's `transformValue` — input
 * recomposes propagate on the next render frame, so async tests gate on
 * `frame.render(...)`.
 */
const nextFrame = () =>
    new Promise<void>((resolve) => {
        frame.render(() => resolve())
    })

describe('utils/motionTemplate - useMotionTemplate', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        vi.useRealTimers()
        cleanups = []
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

    it('returns a real MotionValue (isMotionValue passes)', () => {
        inRoot(() => {
            const blur = useMotionValue(0)
            const filter = useMotionTemplate`blur(${blur}px)`
            expect(isMotionValue(filter)).toBe(true)
        })
    })

    it('seeds the result with the composed initial template', () => {
        inRoot(() => {
            const blur = useMotionValue(4)
            const filter = useMotionTemplate`blur(${blur}px)`
            expect(filter.current).toBe('blur(4px)')
            expect(filter.get()).toBe('blur(4px)')
        })
    })

    it('recomposes when a motion-value input emits', async () => {
        const ctx = inRoot(() => {
            const blur = useMotionValue(0)
            const filter = useMotionTemplate`blur(${blur}px)`
            blur.set(8)
            return { blur, filter }
        })
        await nextFrame()
        expect(ctx.filter.current).toBe('blur(8px)')
    })

    it('handles multiple motion-value inputs', async () => {
        const ctx = inRoot(() => {
            const x = useMotionValue(10)
            const y = useMotionValue(20)
            const result = useMotionTemplate`translate(${x}px, ${y}px)`
            expect(result.current).toBe('translate(10px, 20px)')
            x.set(50)
            return { x, y, result }
        })
        await nextFrame()
        expect(ctx.result.current).toBe('translate(50px, 20px)')
        ctx.y.set(30)
        await nextFrame()
        expect(ctx.result.current).toBe('translate(50px, 30px)')
    })

    it('accepts plain number and string literals as slots', () => {
        inRoot(() => {
            const out = useMotionTemplate`px(${42})`
            expect(out.current).toBe('px(42)')
        })
    })

    it('handles a template with no interpolations', () => {
        inRoot(() => {
            const out = useMotionTemplate`static-string`
            expect(out.current).toBe('static-string')
            expect(get(out)).toBe('static-string')
        })
    })

    it('Svelte readable slot is sampled inline (not auto-tracked)', async () => {
        // Readables don't participate in collectMotionValues, but they ARE
        // sampled via `get(...)` every time a recompose fires (i.e. when an
        // adjacent motion value emits). Verify the readable's latest value is
        // captured.
        const ctx = inRoot(() => {
            const x = useMotionValue(0)
            const w = writable<string>('px')
            const result = useMotionTemplate`size(${x}${w})`
            expect(result.current).toBe('size(0px)')
            // Update both — but only the motion-value emit triggers a
            // recompose. The readable's new value is sampled during that
            // recompose.
            w.set('em')
            x.set(10)
            return { x, w, result }
        })
        await nextFrame()
        expect(ctx.result.current).toBe('size(10em)')
    })

    it('SSR fallback: composes the seed and returns a static motion value', () => {
        vi.stubGlobal('window', undefined)
        const w = writable<number>(7)
        const out = useMotionTemplate`px(${w})`
        expect(isMotionValue(out)).toBe(true)
        expect(out.current).toBe('px(7)')
    })

    it('stops recomposing after root cleanup', async () => {
        // Lifecycle guard: once the surrounding $effect root tears down,
        // motion-dom's destroy() unsubscribes from the input change-bus.
        // Subsequent input emits must not recompose into the (now-destroyed)
        // result.
        let captured!: {
            x: ReturnType<typeof useMotionValue<number>>
            out: ReturnType<typeof useMotionTemplate>
        }
        const stop = $effect.root(() => {
            const x = useMotionValue<number>(1)
            const out = useMotionTemplate`x(${x})`
            captured = { x, out }
        })
        // flushSync ensures the inner $effect(() => () => destroy()) setup
        // has registered its cleanup callback. Without it, stop() would tear
        // down a never-mounted scope and the destroy never fires.
        flushSync()
        expect(captured.out.current).toBe('x(1)')

        // Tear down the root — runs cleanups, destroys the template MV
        // (motion-dom's destroy event unsubscribes the change-bus listener
        // that recomposes the template).
        stop()
        flushSync()

        const before = captured.out.current
        captured.x.set(99)
        await nextFrame()
        expect(captured.out.current).toBe(before)
    })
})
