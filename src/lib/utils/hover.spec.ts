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

// Mock motion-dom.hover
let hoverCallback: ((element: HTMLElement) => (() => void) | void) | null = null
let hoverCleanup: (() => void) | null = null
vi.mock('motion-dom', () => {
    const hoverMock = vi.fn(
        (el: HTMLElement, callback: (element: HTMLElement) => (() => void) | void) => {
            hoverCallback = callback
            hoverCleanup = vi.fn(() => {})
            return hoverCleanup
        }
    )
    return { hover: hoverMock }
})

describe('utils/hover', () => {
    beforeEach(() => {
        animateMock.mockClear()
        hoverCallback = null
        hoverCleanup = null
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

    it('isHoverCapable: returns false when matchMedia throws', () => {
        vi.stubGlobal('matchMedia', (() => {
            throw new Error('matchMedia not supported')
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

    it('computeHoverBaseline: uses opacity default when not in initial/animate', () => {
        const el = document.createElement('div')
        const baseline = computeHoverBaseline(el, {
            whileHover: { opacity: 0 }
        })
        expect(baseline.opacity).toBe(1)
    })

    it('attachWhileHover: animates on enter with nested transition, restores on leave', async () => {
        const el = document.createElement('div')
        const cleanup = attachWhileHover(
            el,
            { scale: 1.2, transition: { duration: 0.12 } },
            { duration: 0.25 },
            undefined,
            { initial: { scale: 1 }, animate: { scale: 1.1 } }
        )

        // Simulate hover start by calling the callback
        expect(hoverCallback).toBeTruthy()
        const hoverEnd = hoverCallback!(el)
        expect(hoverEnd).toBeTruthy()

        await Promise.resolve()
        expect(animateMock).toHaveBeenCalled()
        const enterCall = animateMock.mock.calls.at(-1)
        expect(enterCall?.[1]).toMatchObject({ scale: 1.2 })
        expect(enterCall?.[2]).toMatchObject({ duration: 0.12 })

        // Simulate hover end by calling the cleanup function
        hoverEnd!()
        await Promise.resolve()
        const leaveCall = animateMock.mock.calls.at(-1)
        expect(leaveCall?.[1]).toMatchObject({ scale: 1.1 })
        expect(leaveCall?.[2]).toMatchObject({ duration: 0.25 })
        cleanup()
    })

    it('attachWhileHover: returns cleanup function when whileHover is undefined', () => {
        const el = document.createElement('div')
        const cleanup = attachWhileHover(el, undefined, { duration: 0.2 })
        expect(cleanup).toBeTypeOf('function')
        expect(hoverCallback).toBeNull()
        cleanup()
    })

    it('attachWhileHover: calls onStart and onEnd callbacks', async () => {
        const el = document.createElement('div')
        const onStart = vi.fn()
        const onEnd = vi.fn()
        const cleanup = attachWhileHover(el, { scale: 1.2 }, { duration: 0.2 }, { onStart, onEnd })

        expect(hoverCallback).toBeTruthy()
        const hoverEnd = hoverCallback!(el)
        expect(hoverEnd).toBeTruthy()
        await Promise.resolve()
        expect(onStart).toHaveBeenCalledOnce()

        hoverEnd!()
        await Promise.resolve()
        expect(onEnd).toHaveBeenCalledOnce()
        cleanup()
    })

    describe('CSS variable preservation', () => {
        it('computeHoverBaseline: preserves CSS variables from inline style', () => {
            const el = document.createElement('div')
            el.setAttribute(
                'style',
                'background-color: var(--color-background); color: var(--color-text)'
            )
            Object.defineProperty(window, 'getComputedStyle', {
                value: () => ({
                    backgroundColor: 'rgb(255, 255, 255)',
                    color: 'rgb(0, 0, 0)'
                }),
                configurable: true
            })

            const baseline = computeHoverBaseline(el, {
                whileHover: { backgroundColor: '#f5f5f5', color: '#333' }
            })

            // Should preserve the CSS variable, not the computed RGB value
            expect(baseline.backgroundColor).toBe('var(--color-background)')
            expect(baseline.color).toBe('var(--color-text)')
        })

        it('computeHoverBaseline: uses computed style when no CSS variable present', () => {
            const el = document.createElement('div')
            el.setAttribute('style', 'background-color: #fff')
            Object.defineProperty(window, 'getComputedStyle', {
                value: () => ({ backgroundColor: 'rgb(255, 255, 255)' }),
                configurable: true
            })

            const baseline = computeHoverBaseline(el, {
                whileHover: { backgroundColor: '#000' }
            })

            // Should use computed style when no var() present
            expect(baseline.backgroundColor).toBe('rgb(255, 255, 255)')
        })

        it('computeHoverBaseline: handles mixed CSS vars and static values', () => {
            const el = document.createElement('div')
            el.setAttribute('style', 'background-color: var(--bg); border-width: 2px; color: #000')
            Object.defineProperty(window, 'getComputedStyle', {
                value: () => ({
                    backgroundColor: 'rgb(255, 0, 0)',
                    borderWidth: '2px',
                    color: 'rgb(0, 0, 0)'
                }),
                configurable: true
            })

            const baseline = computeHoverBaseline(el, {
                whileHover: { backgroundColor: '#fff', borderWidth: '4px', color: '#fff' }
            })

            // backgroundColor has var() - should preserve
            expect(baseline.backgroundColor).toBe('var(--bg)')
            // borderWidth and color don't have var() - should use computed
            expect(baseline.borderWidth).toBe('2px')
            expect(baseline.color).toBe('rgb(0, 0, 0)')
        })

        it('computeHoverBaseline: handles kebab-case to camelCase conversion', () => {
            const el = document.createElement('div')
            el.setAttribute('style', 'background-color: var(--primary-bg)')
            Object.defineProperty(window, 'getComputedStyle', {
                value: () => ({ backgroundColor: 'rgb(100, 100, 100)' }),
                configurable: true
            })

            const baseline = computeHoverBaseline(el, {
                whileHover: { backgroundColor: '#000' }
            })

            expect(baseline.backgroundColor).toBe('var(--primary-bg)')
        })

        it('computeHoverBaseline: preserves calc() functions', () => {
            const el = document.createElement('div')
            el.setAttribute('style', 'width: calc(100% - 20px); height: calc(50vh + 10px)')
            Object.defineProperty(window, 'getComputedStyle', {
                value: () => ({ width: '980px', height: '500px' }),
                configurable: true
            })

            const baseline = computeHoverBaseline(el, {
                whileHover: { width: '1000px', height: '600px' }
            })

            expect(baseline.width).toBe('calc(100% - 20px)')
            expect(baseline.height).toBe('calc(50vh + 10px)')
        })

        it('computeHoverBaseline: preserves min/max/clamp functions', () => {
            const el = document.createElement('div')
            el.setAttribute('style', 'width: clamp(200px, 50%, 800px); font-size: max(16px, 1rem)')
            Object.defineProperty(window, 'getComputedStyle', {
                value: () => ({ width: '400px', fontSize: '16px' }),
                configurable: true
            })

            const baseline = computeHoverBaseline(el, {
                whileHover: { width: '500px', fontSize: '20px' }
            })

            expect(baseline.width).toBe('clamp(200px, 50%, 800px)')
            expect(baseline.fontSize).toBe('max(16px, 1rem)')
        })

        it('computeHoverBaseline: preserves color functions (rgb, hsl)', () => {
            const el = document.createElement('div')
            el.setAttribute('style', 'background-color: rgb(255, 0, 0); color: hsl(200, 100%, 50%)')
            Object.defineProperty(window, 'getComputedStyle', {
                value: () => ({
                    backgroundColor: 'rgb(255, 0, 0)',
                    color: 'rgb(0, 191, 255)'
                }),
                configurable: true
            })

            const baseline = computeHoverBaseline(el, {
                whileHover: { backgroundColor: '#000', color: '#fff' }
            })

            expect(baseline.backgroundColor).toBe('rgb(255, 0, 0)')
            expect(baseline.color).toBe('hsl(200, 100%, 50%)')
        })
    })
})
