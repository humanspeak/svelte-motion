import { isMotionValue } from 'motion-dom'
import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScroll } from './scroll.svelte.js'

/**
 * `useScroll` now returns four augmented `MotionValue<number>`s instead of
 * Svelte readable stores. These tests cover the public shape — identity,
 * initial values, `.current` reads, `.subscribe` Svelte compat, and SSR
 * safety. The scroll observer itself is owned by `motion`'s `scroll()`
 * primitive and is tested upstream.
 */
describe('utils/scroll - useScroll', () => {
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

    it('returns four MotionValues with initial 0', () => {
        inRoot(() => {
            const { scrollX, scrollY, scrollXProgress, scrollYProgress } = useScroll()
            expect(isMotionValue(scrollX)).toBe(true)
            expect(isMotionValue(scrollY)).toBe(true)
            expect(isMotionValue(scrollXProgress)).toBe(true)
            expect(isMotionValue(scrollYProgress)).toBe(true)
            expect(scrollX.current).toBe(0)
            expect(scrollY.current).toBe(0)
            expect(scrollXProgress.current).toBe(0)
            expect(scrollYProgress.current).toBe(0)
        })
    })

    it('.current and .get() agree', () => {
        inRoot(() => {
            const { scrollY } = useScroll()
            expect(scrollY.get()).toBe(0)
            expect(scrollY.current).toBe(0)
        })
    })

    it('subscribe emits initial value synchronously', () => {
        inRoot(() => {
            const { scrollYProgress } = useScroll()
            const seen: number[] = []
            const off = scrollYProgress.subscribe((v) => seen.push(v))
            expect(seen).toEqual([0])
            off()
        })
    })

    it('svelte store get() round-trips through the .subscribe shim', () => {
        inRoot(() => {
            const { scrollY } = useScroll()
            expect(get(scrollY)).toBe(0)
        })
    })

    it('SSR fallback: returns motion values with no observer when window is undefined', () => {
        vi.stubGlobal('window', undefined)
        const { scrollX, scrollY, scrollXProgress, scrollYProgress } = useScroll()
        expect(isMotionValue(scrollX)).toBe(true)
        expect(scrollX.current).toBe(0)
        expect(scrollY.current).toBe(0)
        expect(scrollXProgress.current).toBe(0)
        expect(scrollYProgress.current).toBe(0)
    })
})
