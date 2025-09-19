import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    attachWhileHover,
    computeHoverBaseline,
    isHoverCapable,
    splitHoverDefinition
} from './hover.js'

// Mock motion.animate
vi.mock('motion', () => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { animate: animateMock }
})
const { animate: animateMock } = (await import('motion')) as unknown as {
    animate: ReturnType<typeof vi.fn> & { mockClear: () => void; mock: { calls: unknown[][] } }
}

describe('utils/hover', () => {
    beforeEach(() => {
        animateMock.mockClear()
        // default to hover-capable environment
        vi.stubGlobal('matchMedia', ((query: string) => {
            const matches = query.includes('(hover: hover)') || query.includes('(pointer: fine)')
            return {
                matches,
                media: query,
                onchange: null,
                addEventListener() {},
                removeEventListener() {},
                addListener() {},
                removeListener() {},
                dispatchEvent() {
                    return false
                }
            } as unknown as MediaQueryList
        }) as unknown as typeof window.matchMedia)
    })

    it('isHoverCapable: positive on hover+fine pointer', () => {
        expect(isHoverCapable()).toBe(true)
    })

    it('isHoverCapable: negative on non-hover env', () => {
        vi.stubGlobal('matchMedia', ((query: string) => {
            return {
                matches: false,
                media: query,
                onchange: null,
                addEventListener() {},
                removeEventListener() {},
                addListener() {},
                removeListener() {},
                dispatchEvent() {
                    return false
                }
            } as unknown as MediaQueryList
        }) as unknown as typeof window.matchMedia)
        expect(isHoverCapable()).toBe(false)
    })

    it('splitHoverDefinition: extracts nested transition when present', () => {
        const def = { scale: 1.2, transition: { duration: 0.12 } }
        const { keyframes, transition } = splitHoverDefinition(def)
        expect(keyframes).toMatchObject({ scale: 1.2 })
        expect(transition).toMatchObject({ duration: 0.12 })
    })

    it('splitHoverDefinition: handles no transition', () => {
        const def = { opacity: 1 }
        const { keyframes, transition } = splitHoverDefinition(def)
        expect(keyframes).toMatchObject({ opacity: 1 })
        expect(transition).toBeUndefined()
    })

    it('splitHoverDefinition: handles undefined input gracefully', () => {
        // @ts-expect-error testing undefined
        const { keyframes, transition } = splitHoverDefinition(undefined)
        expect(keyframes).toMatchObject({})
        expect(transition).toBeUndefined()
    })

    it('computeHoverBaseline: prefers animate over initial, with defaults', () => {
        const el = document.createElement('div')
        el.style.transform = 'translate(10px, 20px) scale(2)'
        const baseline = computeHoverBaseline(el, {
            initial: { scale: 0.9, x: 5 },
            animate: { scale: 1.1 },
            whileHover: { scale: 1.2, x: 0, y: 0 }
        })
        expect(baseline).toMatchObject({ scale: 1.1, x: 5, y: 0 })
    })

    it('computeHoverBaseline: negative returns empty for unknown keys', () => {
        const el = document.createElement('div')
        const baseline = computeHoverBaseline(el, {
            initial: { a: 1 },
            animate: { b: 2 },
            whileHover: { c: 3 }
        })
        expect(Object.keys(baseline)).toHaveLength(0)
    })

    it('computeHoverBaseline: uses computed style fallback when available', () => {
        const el = document.createElement('div')
        Object.defineProperty(window, 'getComputedStyle', {
            value: () => ({ color: 'rgb(0, 0, 0)' }),
            configurable: true
        })
        const baseline = computeHoverBaseline(el, {
            whileHover: { color: 'red' }
        })
        expect(baseline.color).toBe('rgb(0, 0, 0)')
    })

    it('attachWhileHover: animates on enter with nested transition, restores on leave', async () => {
        const el = document.createElement('div')
        const cleanup = attachWhileHover(
            el,
            { scale: 1.2, transition: { duration: 0.12 } },
            { duration: 0.25 },
            undefined,
            () => true,
            { initial: { scale: 1 }, animate: { scale: 1.1 } }
        )
        el.dispatchEvent(new PointerEvent('pointerenter'))
        await Promise.resolve()
        expect(animateMock).toHaveBeenCalled()
        const enterCall = animateMock.mock.calls.at(-1)
        expect(enterCall?.[1]).toMatchObject({ scale: 1.2 })
        expect(enterCall?.[2]).toMatchObject({ duration: 0.12 })

        el.dispatchEvent(new PointerEvent('pointerleave'))
        await Promise.resolve()
        const leaveCall = animateMock.mock.calls.at(-1)
        expect(leaveCall?.[1]).toMatchObject({ scale: 1.1 })
        expect(leaveCall?.[2]).toMatchObject({ duration: 0.25 })
        cleanup()
    })

    it('attachWhileHover: negative does nothing when capability is false', async () => {
        const el = document.createElement('div')
        animateMock.mockClear()
        const cleanup = attachWhileHover(
            el,
            { scale: 1.05 },
            { duration: 0.2 },
            undefined,
            () => false
        )
        el.dispatchEvent(new PointerEvent('pointerenter'))
        await Promise.resolve()
        expect(animateMock).not.toHaveBeenCalled()
        cleanup()
    })
})
