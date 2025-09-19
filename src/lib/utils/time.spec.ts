import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTime } from './time.js'

describe('utils/time - useTime', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('returns a readable store that increases over time', async () => {
        let rafCb: FrameRequestCallback | null = null
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            rafCb = cb
            return 1 as unknown as number
        })
        vi.stubGlobal('cancelAnimationFrame', () => {})
        vi.spyOn(performance, 'now').mockReturnValue(0)

        const time = useTime()
        expect(get(time)).toBe(0)

        // Advance first frame (simulate a frame via mocked rAF callback)
        // @ts-expect-error simulate SSR
        rafCb?.(100)
        expect(get(time)).toBe(100)

        // Next frame (simulate another frame)
        // @ts-expect-error simulate SSR
        rafCb?.(500)
        expect(get(time)).toBe(500)

        vi.unstubAllGlobals()
    })

    it('is SSR-safe (no window)', () => {
        vi.stubGlobal('window', undefined)
        const time = useTime()
        expect(get(time)).toBe(0)
        vi.unstubAllGlobals()
    })

    it('returns the same store for the same id (shared timeline)', () => {
        let rafCb: FrameRequestCallback | null = null
        const rafSpy = vi
            .spyOn(
                globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame },
                'requestAnimationFrame'
            )
            .mockImplementation((cb: FrameRequestCallback) => {
                rafCb = cb
                return 1 as unknown as number
            })
        vi.stubGlobal('cancelAnimationFrame', () => {})

        const a = useTime('shared')
        const b = useTime('shared')
        expect(a).toBe(b)

        // @ts-expect-error simulate SSR
        rafCb?.(250)
        expect(get(a)).toBe(get(b))
        // Next frame was scheduled by the loop
        expect(rafSpy).toHaveBeenCalledTimes(2)

        rafSpy.mockRestore()
    })

    it('cancels rAF and removes shared store on unsubscribe', () => {
        const cancelSpy = vi.fn()
        vi.stubGlobal('requestAnimationFrame', () => 123 as unknown as number)
        vi.stubGlobal('cancelAnimationFrame', cancelSpy)

        const store = useTime('to-clean')
        const unsub = store.subscribe(() => {})
        unsub()
        expect(cancelSpy).toHaveBeenCalledWith(123)

        const store2 = useTime('to-clean')
        expect(store2).not.toBe(store)

        vi.unstubAllGlobals()
    })

    it('cancels rAF for non-shared store on unsubscribe', () => {
        const cancelSpy = vi.fn()
        vi.stubGlobal('requestAnimationFrame', () => 321 as unknown as number)
        vi.stubGlobal('cancelAnimationFrame', cancelSpy)

        const store = useTime()
        const unsub = store.subscribe(() => {})
        unsub()
        expect(cancelSpy).toHaveBeenCalledWith(321)

        vi.unstubAllGlobals()
    })

    it('is SSR-safe for shared id (no window)', () => {
        vi.stubGlobal('window', undefined)
        const t = useTime('any')
        expect(get(t)).toBe(0)
        vi.unstubAllGlobals()
    })
})
