import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    computeHoverBaseline,
    isHoverCapable,
    parseUnitValue,
    readTransformChannels,
    splitHoverDefinition
} from './hover.js'

// Capture the pristine jsdom implementation at module-eval time, before any
// test replaces `window.getComputedStyle` with a stub. Authored-value cases
// below restore it so they exercise the real cascade (inline + stylesheet).
const REAL_GET_COMPUTED_STYLE = globalThis.getComputedStyle

// Mock motion.animate
vi.mock('motion', () => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { animate: animateMock }
})
const { animate: animateMock } = (await import('motion')) as unknown as {
    animate: ReturnType<typeof vi.fn> & { mockClear: () => void; mock: { calls: unknown[][] } }
}

// `motion-dom` stays mocked for the animation helpers the surviving pure-function
// tests share with the rest of the suite. The `hover()` interception that the
// deleted `attachWhileHover` tests drove is gone with them (plan 003).
vi.mock('motion-dom', async () => {
    const actual = await vi.importActual<typeof import('motion-dom')>('motion-dom')
    const hoverMock = vi.fn(() => vi.fn(() => {}))
    const animateValueMock = vi.fn(
        ({
            keyframes,
            onUpdate,
            onComplete
        }: {
            keyframes?: unknown[]
            onUpdate?: (value: number) => void
            onComplete?: () => void
        }) => {
            const finalValue = Number(keyframes?.at(-1))
            if (Number.isFinite(finalValue)) onUpdate?.(finalValue)
            onComplete?.()
            return { stop: vi.fn(), then: vi.fn() }
        }
    )
    // The composed writer now drives channels via `animateMotionValue`, which
    // returns a StartAnimation `(onComplete) => controls`. Mirror the old
    // synchronous animateValue behavior: settle the value on the final keyframe
    // (firing its real change→write subscription) and complete immediately.
    const animateMotionValueMock = vi.fn(
        (_name: string, value: { set: (v: number) => void }, target: number | number[]) =>
            (onComplete?: () => void) => {
                const final = Array.isArray(target) ? target[target.length - 1] : target
                const finalNumber =
                    typeof final === 'number' ? final : Number.parseFloat(String(final))
                if (Number.isFinite(finalNumber)) value.set(finalNumber)
                onComplete?.()
                return { stop: vi.fn() }
            }
    )
    return {
        ...actual,
        animateValue: animateValueMock,
        animateMotionValue: animateMotionValueMock,
        hover: hoverMock
    }
})

describe('utils/hover', () => {
    beforeEach(() => {
        animateMock.mockClear()
        // default to hover-capable environment
        vi.stubGlobal('matchMedia', (query: string) => {
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
        })
    })

    it('isHoverCapable: positive on hover+fine pointer', () => {
        expect(isHoverCapable()).toBe(true)
    })

    it('isHoverCapable: negative on non-hover env', () => {
        vi.stubGlobal('matchMedia', (query: string) => {
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
        })
        expect(isHoverCapable()).toBe(false)
    })

    it('isHoverCapable: returns false when matchMedia throws', () => {
        vi.stubGlobal('matchMedia', () => {
            throw new Error('matchMedia not supported')
        })
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

describe('utils/hover computeHoverBaseline authored values (plan 003)', () => {
    beforeEach(() => {
        // Restore the real jsdom cascade so authored style values are readable.
        Object.defineProperty(window, 'getComputedStyle', {
            value: REAL_GET_COMPUTED_STYLE,
            configurable: true
        })
    })

    it('restores an inline style-authored opacity, not the neutral default', () => {
        const el = document.createElement('div')
        el.setAttribute('style', 'opacity: 0.8')
        document.body.appendChild(el)

        const baseline = computeHoverBaseline(el, {
            whileHover: { opacity: 1 }
        })

        // Upstream getBaseTarget has no neutral-default step: the authored 0.8
        // must win over the hardcoded neutral opacity: 1.
        expect(Number(baseline.opacity)).toBe(0.8)
        el.remove()
    })

    it('restores a stylesheet-authored opacity (non-inline authorship)', () => {
        const style = document.createElement('style')
        style.textContent = '.plan003-sheet { opacity: 0.65; }'
        document.head.appendChild(style)
        const el = document.createElement('div')
        el.className = 'plan003-sheet'
        document.body.appendChild(el)

        const baseline = computeHoverBaseline(el, {
            whileHover: { opacity: 1 }
        })

        expect(Number(baseline.opacity)).toBe(0.65)
        el.remove()
        style.remove()
    })

    it('lets animate outrank an authored style value for the same key', () => {
        const el = document.createElement('div')
        el.setAttribute('style', 'opacity: 0.8')
        document.body.appendChild(el)

        const baseline = computeHoverBaseline(el, {
            animate: { opacity: 0.3 },
            whileHover: { opacity: 1 }
        })

        expect(baseline.opacity).toBe(0.3)
        el.remove()
    })

    it('lets initial outrank an authored style value for the same key', () => {
        const el = document.createElement('div')
        el.setAttribute('style', 'opacity: 0.8')
        document.body.appendChild(el)

        const baseline = computeHoverBaseline(el, {
            initial: { opacity: 0.4 },
            whileHover: { opacity: 1 }
        })

        expect(baseline.opacity).toBe(0.4)
        el.remove()
    })

    it('lets baseValues outrank an authored style value for a transform channel', () => {
        const el = document.createElement('div')
        document.body.appendChild(el)

        const baseline = computeHoverBaseline(el, {
            baseValues: { scale: 1.5 },
            whileHover: { scale: 1.2 }
        })

        expect(baseline.scale).toBe(1.5)
        el.remove()
    })

    it('still neutral-defaults a transform channel with nothing authored', () => {
        const el = document.createElement('div')
        document.body.appendChild(el)

        const baseline = computeHoverBaseline(el, {
            whileHover: { rotate: 10, scale: 1.2 }
        })

        // Transform channels intentionally skip the computed-style step: a
        // matrix string is not a per-channel value, so neutral defaults stand.
        expect(baseline.rotate).toBe(0)
        expect(baseline.scale).toBe(1)
        el.remove()
    })
})

describe('utils/hover parseUnitValue', () => {
    it('reports an empty unit for finite numbers', () => {
        expect(parseUnitValue(8)).toEqual({ value: 8, unit: '' })
        expect(parseUnitValue(-3.5)).toEqual({ value: -3.5, unit: '' })
        expect(parseUnitValue(0)).toEqual({ value: 0, unit: '' })
    })

    it('parses unit-suffixed strings into magnitude and unit', () => {
        expect(parseUnitValue('-50%')).toEqual({ value: -50, unit: '%' })
        expect(parseUnitValue('2rem')).toEqual({ value: 2, unit: 'rem' })
        expect(parseUnitValue('10px')).toEqual({ value: 10, unit: 'px' })
        expect(parseUnitValue('1.5em')).toEqual({ value: 1.5, unit: 'em' })
    })

    it('treats a unitless numeric string as an empty unit (numeric path)', () => {
        expect(parseUnitValue('1.2')).toEqual({ value: 1.2, unit: '' })
        expect(parseUnitValue('  8  ')).toEqual({ value: 8, unit: '' })
    })

    it('trims surrounding whitespace before parsing', () => {
        expect(parseUnitValue('  -50%  ')).toEqual({ value: -50, unit: '%' })
    })

    it('returns null for non-parseable strings', () => {
        expect(parseUnitValue('red')).toBeNull()
        expect(parseUnitValue('var(--x)')).toBeNull()
        expect(parseUnitValue('calc(100% - 20px)')).toBeNull()
        expect(parseUnitValue('')).toBeNull()
    })

    it('returns null for non-finite numbers and non-primitive values', () => {
        expect(parseUnitValue(Number.NaN)).toBeNull()
        expect(parseUnitValue(Number.POSITIVE_INFINITY)).toBeNull()
        expect(parseUnitValue(null)).toBeNull()
        expect(parseUnitValue(undefined)).toBeNull()
        expect(parseUnitValue([1, 2])).toBeNull()
        expect(parseUnitValue({})).toBeNull()
    })
})

describe('utils/hover readTransformChannels', () => {
    const withTransform = (transform: string): HTMLElement => {
        const el = document.createElement('div')
        Object.defineProperty(window, 'getComputedStyle', {
            value: () => ({ transform }),
            configurable: true
        })
        return el
    }

    it('returns identity values for an untransformed element', () => {
        expect(readTransformChannels(withTransform('none'))).toEqual({
            scale: 1,
            x: 0,
            y: 0,
            rotate: 0
        })
        expect(readTransformChannels(withTransform(''))).toEqual({
            scale: 1,
            x: 0,
            y: 0,
            rotate: 0
        })
    })

    it('reads translate-only from matrix e/f', () => {
        // matrix(1, 0, 0, 1, 30, -20) — pure translate.
        const channels = readTransformChannels(withTransform('matrix(1, 0, 0, 1, 30, -20)'))
        expect(channels).not.toBeNull()
        expect(channels?.x).toBeCloseTo(30, 5)
        expect(channels?.y).toBeCloseTo(-20, 5)
        expect(channels?.scale).toBeCloseTo(1, 5)
        expect(channels?.rotate).toBeCloseTo(0, 5)
    })

    it('decomposes a combined rotate + uniform scale', () => {
        // rotate(90deg) scale(2) → matrix(0, 2, -2, 0, 0, 0):
        //   a = 2*cos(90) = 0, b = 2*sin(90) = 2, c = -2*sin(90) = -2, d = 0.
        const channels = readTransformChannels(withTransform('matrix(0, 2, -2, 0, 0, 0)'))
        expect(channels).not.toBeNull()
        expect(channels?.scale).toBeCloseTo(2, 5)
        expect(channels?.rotate).toBeCloseTo(90, 5)
        expect(channels?.x).toBeCloseTo(0, 5)
        expect(channels?.y).toBeCloseTo(0, 5)
    })

    it('reports a negative rotation with the browser sign convention', () => {
        // rotate(-30deg): a = cos(-30) ≈ 0.866, b = sin(-30) = -0.5.
        const channels = readTransformChannels(
            withTransform('matrix(0.866, -0.5, 0.5, 0.866, 0, 0)')
        )
        expect(channels?.rotate).toBeCloseTo(-30, 2)
    })

    it('returns null for a 3D matrix (out of scope)', () => {
        expect(
            readTransformChannels(
                withTransform('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)')
            )
        ).toBeNull()
    })
})
