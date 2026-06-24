import { isMotionValue, motionValue } from 'motion-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { isWillChangeMotionValue, useWillChange } from './willChange.svelte.js'

/**
 * `useWillChange` returns a motion-dom MotionValue (tested upstream for the
 * value machinery) augmented with an `add()` method that flips `will-change`
 * from `'auto'` to `'transform'` once a transform or accelerated property
 * animates. These tests cover that gating logic and the augmentation layer.
 */
describe('utils/willChange - useWillChange', () => {
    let cleanups: VoidFunction[] = []

    afterEach(() => {
        for (const fn of cleanups) fn()
        cleanups = []
    })

    const inRoot = <T>(fn: () => T): T => {
        let result: T
        const stop = $effect.root(() => {
            result = fn()
        })
        cleanups.push(stop)
        return result!
    }

    it('returns a real MotionValue starting at "auto"', () => {
        inRoot(() => {
            const wc = useWillChange()
            expect(isMotionValue(wc)).toBe(true)
            expect(wc.get()).toBe('auto')
            expect(wc.current).toBe('auto')
        })
    })

    it('flips to "transform" when a transform prop animates', () => {
        inRoot(() => {
            const wc = useWillChange()
            wc.add('x')
            expect(wc.get()).toBe('transform')
            expect(wc.current).toBe('transform')
        })
    })

    it('flips to "transform" for accelerated values like opacity', () => {
        inRoot(() => {
            const wc = useWillChange()
            wc.add('opacity')
            expect(wc.get()).toBe('transform')
        })
    })

    it('ignores non-transform, non-accelerated properties', () => {
        inRoot(() => {
            const wc = useWillChange()
            wc.add('backgroundColor')
            wc.add('borderRadius')
            expect(wc.get()).toBe('auto')
        })
    })

    it('stays enabled once a transform animates (idempotent)', () => {
        inRoot(() => {
            const wc = useWillChange()
            wc.add('scale')
            expect(wc.get()).toBe('transform')
            // A later non-transform key must not reset the hint.
            wc.add('backgroundColor')
            expect(wc.get()).toBe('transform')
        })
    })

    it('isWillChangeMotionValue detects the hook value, rejects plain values', () => {
        inRoot(() => {
            const wc = useWillChange()
            expect(isWillChangeMotionValue(wc)).toBe(true)
            expect(isWillChangeMotionValue(motionValue('auto'))).toBe(false)
            expect(isWillChangeMotionValue(null)).toBe(false)
            expect(isWillChangeMotionValue('transform')).toBe(false)
        })
    })
})
