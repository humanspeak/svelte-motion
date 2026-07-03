import { isMotionValue, motionValue as rawMotionValue } from 'motion-dom'
import { flushSync } from 'svelte'
import { writable } from 'svelte/store'
import { describe, expect, it } from 'vitest'
import { toMotionValue } from './toMotionValue.svelte.js'

describe('toMotionValue', () => {
    it('passes an existing MotionValue through with the same identity', () => {
        const source = rawMotionValue(5)
        const value = toMotionValue(source)
        expect(value).toBe(source)
        expect(value.current).toBe(5)
        source.set(9)
        expect(value.get()).toBe(9)
    })

    it('does not re-augment an already-augmented value', () => {
        const source = rawMotionValue(1)
        const once = toMotionValue(source)
        const twice = toMotionValue(once)
        expect(twice).toBe(once)
    })

    it('mirrors a Svelte readable store', () => {
        const store = writable(10)
        const value = toMotionValue(store)
        expect(value.get()).toBe(10)
        store.set(25)
        expect(value.get()).toBe(25)
        expect(isMotionValue(value)).toBe(true)
        value.destroy()
        store.set(99)
        expect(value.get()).toBe(25)
    })

    it('tracks rune state through a getter', () => {
        let progress = $state(0)
        const value = toMotionValue(() => progress / 100)
        expect(value.get()).toBe(0)

        progress = 50
        flushSync()
        expect(value.get()).toBe(0.5)

        progress = 100
        flushSync()
        expect(value.get()).toBe(1)

        value.destroy()
        progress = 10
        flushSync()
        expect(value.get()).toBe(1)
    })

    it('tracks another augmented value read via .current inside a getter', () => {
        const source = toMotionValue(rawMotionValue(2))
        const doubled = toMotionValue(() => source.current * 2)
        expect(doubled.get()).toBe(4)

        source.set(10)
        flushSync()
        expect(doubled.get()).toBe(20)

        doubled.destroy()
    })

    it('getter values compose with motion-dom consumers (isMotionValue)', () => {
        const n = $state(1)
        const value = toMotionValue(() => n)
        expect(isMotionValue(value)).toBe(true)
        value.destroy()
    })
})
