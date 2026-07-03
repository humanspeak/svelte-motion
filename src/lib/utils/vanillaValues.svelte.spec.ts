import { isMotionValue } from 'motion-dom'
import { flushSync } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { mapValue, motionValue, springValue, transformValue } from './vanillaValues.svelte.js'

describe('vanilla motionValue', () => {
    it('creates an augmented value outside component context', () => {
        const x = motionValue(3)
        expect(isMotionValue(x)).toBe(true)
        expect(x.current).toBe(3)
        x.set(7)
        expect(x.get()).toBe(7)
        expect(x.current).toBe(7)
        x.destroy()
    })

    it('implements the readable store contract', () => {
        const x = motionValue(1)
        const seen: number[] = []
        const unsubscribe = x.subscribe((value) => seen.push(value))
        x.set(2)
        expect(seen).toEqual([1, 2])
        unsubscribe()
        x.destroy()
    })
})

describe('vanilla transformValue', () => {
    it('recomputes when tracked MotionValues change', async () => {
        const x = motionValue(2)
        const doubled = transformValue(() => x.get() * 2)
        expect(doubled.get()).toBe(4)
        x.set(5)
        await vi.advanceTimersByTimeAsync(50)
        expect(doubled.get()).toBe(10)
        doubled.destroy()
        x.destroy()
    })
})

describe('vanilla mapValue', () => {
    it('maps a MotionValue source across ranges', async () => {
        const x = motionValue(0)
        const opacity = mapValue(x, [0, 100], [1, 0])
        expect(opacity.get()).toBe(1)
        x.set(50)
        await vi.advanceTimersByTimeAsync(50)
        expect(opacity.get()).toBe(0.5)
        opacity.destroy()
        x.destroy()
    })

    it('accepts a rune getter as a source and tears the bridge down on destroy', async () => {
        let n = $state(0)
        const mapped = mapValue(() => n, [0, 10], [0, 100])
        expect(mapped.get()).toBe(0)

        n = 5
        flushSync()
        await vi.advanceTimersByTimeAsync(50)
        expect(mapped.get()).toBe(50)

        mapped.destroy()
        n = 10
        flushSync()
        await vi.advanceTimersByTimeAsync(50)
        expect(mapped.get()).toBe(50)
    })
})

describe('vanilla springValue', () => {
    it('accepts a static initial number', () => {
        const spring = springValue(0, { stiffness: 300, damping: 30 })
        expect(isMotionValue(spring)).toBe(true)
        expect(spring.get()).toBe(0)
        spring.destroy()
    })

    it('follows a MotionValue source toward its target', async () => {
        const x = motionValue(0)
        const smooth = springValue(x, { stiffness: 1000, damping: 100 })
        x.set(100)
        await vi.advanceTimersByTimeAsync(2000)
        expect(smooth.get()).toBeGreaterThan(0)
        smooth.destroy()
        x.destroy()
    })
})
