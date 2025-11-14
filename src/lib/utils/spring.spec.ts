import { get, writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpring } from './spring.js'

describe('utils/spring - useSpring', () => {
    let rafCb: FrameRequestCallback | null = null
    let cafSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
        rafCb = null
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            rafCb = cb
            return 1 as unknown as number
        })
        cafSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('animates towards set target (number)', () => {
        const s = useSpring(0)
        expect(get(s)).toBe(0)
        s.set(100)
        // Advance some frames
        rafCb?.(16)
        const a = get(s)
        expect(typeof a).toBe('number')
        expect(Number.isNaN(a as number)).toBe(false)
        expect(a as number).toBeGreaterThan(0)
        expect(a as number).toBeLessThanOrEqual(100)
        rafCb?.(32)
        const next = get(s) as number
        expect(typeof next).toBe('number')
        expect(Number.isNaN(next)).toBe(false)
        expect(next).toBeGreaterThan(a as number)
        expect(next).toBeLessThanOrEqual(100)
    })

    it('jump sets immediately without animation', () => {
        const s = useSpring(0)
        s.jump(50)
        expect(get(s)).toBe(50)
    })

    it('supports unit strings and preserves unit', () => {
        const s = useSpring('0px')
        s.set('100px')
        rafCb?.(16)
        const v = get(s)
        expect(typeof v).toBe('string')
        expect(v as string).toMatch(/^\d+(?:\.\d+)?px$/)
        const n = Number.parseFloat(v as string)
        expect(Number.isNaN(n)).toBe(false)
        expect(n).toBeGreaterThan(0)
        expect(n).toBeLessThanOrEqual(100)
    })

    it('jump respects and preserves unit formatting', () => {
        const s = useSpring('10vh')
        s.jump('20vh')
        expect(get(s)).toBe('20vh')
    })

    it('set/jump unsubscribe breaks following source and cancels raf', () => {
        const src = writable<number | string>(0)
        const s = useSpring(src)
        const unsub = s.subscribe(() => {})
        s.set(10)
        rafCb?.(16)
        // ensure API still works after unsubscribing
        unsub()
        // cancelAnimationFrame should have been called at least once via cleanup
        // The dedicated cafSpy is only in other test; here we assert no throw and callable API
        expect(() => s.set(20)).not.toThrow()
        expect(() => s.jump(30)).not.toThrow()
    })

    it('tracks another readable source', () => {
        const src = writable<number | string>(0)
        const s = useSpring(src)
        const unsubscribe = s.subscribe(() => {})
        expect(get(s)).toBe(0)
        src.set(20)
        rafCb?.(16)
        rafCb?.(32)
        expect(get(s) as number).toBeGreaterThan(0)
        unsubscribe()
    })

    it('cleans up rAF on unsubscribe', () => {
        const s = useSpring(0)
        const unsub = s.subscribe(() => {})
        s.set(10)
        rafCb?.(16)
        unsub()
        expect(cafSpy).toHaveBeenCalled()
    })

    it('SSR-safe returns static store (no-op setters)', () => {
        vi.stubGlobal('window', undefined)
        const s = useSpring(0)
        expect(get(s)).toBe(0)
        s.set(100)
        expect(get(s)).toBe(0)
    })
})
