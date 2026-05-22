import { isMotionValue } from 'motion-dom'
import { get, writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMotionTemplate } from './motionTemplate.svelte.js'
import { useMotionValue } from './motionValue.svelte.js'

/**
 * `useMotionTemplate` now returns an augmented motion-dom
 * `MotionValue<string>`. These tests cover the public surface (identity,
 * `.current`, `.subscribe`), recompute on input emit, mixed MotionValue +
 * Svelte readable sources, edge cases (no interpolations, single static
 * string), and SSR safety.
 */
describe('utils/motionTemplate - useMotionTemplate', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
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

    it('recomposes when a motion-value input emits', () => {
        inRoot(() => {
            const blur = useMotionValue(0)
            const filter = useMotionTemplate`blur(${blur}px)`
            blur.set(8)
            expect(filter.current).toBe('blur(8px)')
        })
    })

    it('recomposes when a Svelte-readable input emits', () => {
        inRoot(() => {
            const w = writable<number>(0)
            const out = useMotionTemplate`hue(${w})`
            w.set(120)
            expect(get(out)).toBe('hue(120)')
        })
    })

    it('handles multiple mixed inputs', () => {
        inRoot(() => {
            const x = useMotionValue(10)
            const y = writable<string>('20%')
            const out = useMotionTemplate`translate(${x}px, ${y})`
            expect(out.current).toBe('translate(10px, 20%)')
            x.set(50)
            expect(out.current).toBe('translate(50px, 20%)')
            y.set('30%')
            expect(out.current).toBe('translate(50px, 30%)')
        })
    })

    it('handles a template with no interpolations', () => {
        inRoot(() => {
            const out = useMotionTemplate`static-string`
            expect(out.current).toBe('static-string')
            expect(get(out)).toBe('static-string')
        })
    })

    it('SSR fallback: returns a static composed motion value', () => {
        vi.stubGlobal('window', undefined)
        const w = writable<number>(7)
        const out = useMotionTemplate`px(${w})`
        expect(isMotionValue(out)).toBe(true)
        expect(out.current).toBe('px(7)')
    })
})
