import { get } from 'svelte/store'
import { describe, expect, it } from 'vitest'
import { useMotionValue } from './motionValue.js'
import { useTransform } from './transform.js'

describe('utils/motionValue', () => {
    it('returns initial value via get()', () => {
        const mv = useMotionValue(42)
        expect(mv.get()).toBe(42)
    })

    it('returns initial value via store subscription', () => {
        const mv = useMotionValue(42)
        expect(get(mv)).toBe(42)
    })

    it('set() updates both store and get()', () => {
        const mv = useMotionValue(0)
        mv.set(99)
        expect(mv.get()).toBe(99)
        expect(get(mv)).toBe(99)
    })

    it('works with useTransform mapping form', () => {
        const mv = useMotionValue(0)
        const out = useTransform(mv, [0, 100], [0, 1])
        expect(get(out)).toBe(0)
        mv.set(50)
        expect(get(out)).toBeCloseTo(0.5)
        mv.set(100)
        expect(get(out)).toBe(1)
    })

    it('multiple subscribers receive updates', () => {
        const mv = useMotionValue(0)
        const values1: number[] = []
        const values2: number[] = []
        const unsub1 = mv.subscribe((v) => values1.push(v))
        const unsub2 = mv.subscribe((v) => values2.push(v))

        mv.set(1)
        mv.set(2)

        expect(values1).toEqual([0, 1, 2])
        expect(values2).toEqual([0, 1, 2])

        unsub1()
        unsub2()
    })

    it('works with non-numeric types', () => {
        const mv = useMotionValue('hello')
        expect(mv.get()).toBe('hello')
        mv.set('world')
        expect(mv.get()).toBe('world')
        expect(get(mv)).toBe('world')
    })
})
