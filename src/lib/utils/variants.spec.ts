import type { Variants } from '$lib/types'
import { describe, expect, it } from 'vitest'
import { resolveAnimate, resolveExit, resolveInitial, resolveVariant } from './variants.js'

describe('utils/variants - resolveVariant', () => {
    it('returns the static keyframes object for an object-form variant', () => {
        const variants: Variants = { visible: { opacity: 1 } }
        expect(resolveVariant(variants, 'visible')).toEqual({ opacity: 1 })
    })

    it('returns undefined for an unknown key', () => {
        const variants: Variants = { visible: { opacity: 1 } }
        expect(resolveVariant(variants, 'missing')).toBeUndefined()
    })

    it('returns undefined when variants or key are absent', () => {
        expect(resolveVariant(undefined, 'visible')).toBeUndefined()
        expect(resolveVariant({}, undefined)).toBeUndefined()
    })

    it('invokes function-form variants with the supplied custom value', () => {
        const variants: Variants = {
            visible: (i) => ({ x: (i as number) * 50, opacity: 1 })
        }
        expect(resolveVariant(variants, 'visible', 3)).toEqual({ x: 150, opacity: 1 })
    })

    it('passes undefined to function-form variants when no custom is supplied', () => {
        const variants: Variants = {
            visible: (custom) => ({ flag: custom === undefined ? 'absent' : 'present' }) as never
        }
        expect(resolveVariant(variants, 'visible')).toEqual({ flag: 'absent' })
    })

    it('passes 0 (falsy) custom through to the factory as 0, not undefined', () => {
        // Regression guard: a `custom={0}` from a stagger index must reach
        // the factory as 0, not coerced to undefined or fallback values.
        const variants: Variants = {
            visible: (i) => ({ x: (i as number) * 10 })
        }
        expect(resolveVariant(variants, 'visible', 0)).toEqual({ x: 0 })
    })
})

describe('utils/variants - resolveInitial', () => {
    it('returns false unchanged when initial is false', () => {
        expect(resolveInitial(false, undefined)).toBe(false)
    })

    it('returns undefined when initial is undefined', () => {
        expect(resolveInitial(undefined, undefined)).toBeUndefined()
    })

    it('passes object-form initial through unchanged', () => {
        expect(resolveInitial({ x: 10 }, undefined)).toEqual({ x: 10 })
    })

    it('resolves a string initial against variants', () => {
        const variants: Variants = { hidden: { opacity: 0 } }
        expect(resolveInitial('hidden', variants)).toEqual({ opacity: 0 })
    })

    it('forwards custom to function-form variants', () => {
        const variants: Variants = {
            hidden: (i) => ({ x: -(i as number) * 100 })
        }
        expect(resolveInitial('hidden', variants, 2)).toEqual({ x: -200 })
    })
})

describe('utils/variants - resolveAnimate', () => {
    it('passes object-form animate through unchanged', () => {
        expect(resolveAnimate({ scale: 1.2 }, undefined)).toEqual({ scale: 1.2 })
    })

    it('resolves a string animate against variants', () => {
        const variants: Variants = { visible: { opacity: 1 } }
        expect(resolveAnimate('visible', variants)).toEqual({ opacity: 1 })
    })

    it('forwards custom to function-form variants', () => {
        const variants: Variants = {
            visible: (i) => ({ delay: (i as number) * 0.1 }) as never
        }
        expect(resolveAnimate('visible', variants, 4)).toEqual({ delay: 0.4 })
    })

    it('returns undefined when animate is undefined', () => {
        expect(resolveAnimate(undefined, undefined)).toBeUndefined()
    })
})

describe('utils/variants - resolveExit', () => {
    it('passes object-form exit through unchanged', () => {
        expect(resolveExit({ y: -100 }, undefined)).toEqual({ y: -100 })
    })

    it('resolves a string exit against variants', () => {
        const variants: Variants = { hidden: { opacity: 0 } }
        expect(resolveExit('hidden', variants)).toEqual({ opacity: 0 })
    })

    it('forwards custom to function-form variants', () => {
        const variants: Variants = {
            hidden: (direction) => ({ x: (direction as number) > 0 ? 200 : -200 }) as never
        }
        expect(resolveExit('hidden', variants, 1)).toEqual({ x: 200 })
        expect(resolveExit('hidden', variants, -1)).toEqual({ x: -200 })
    })

    it('returns undefined when exit is undefined', () => {
        expect(resolveExit(undefined, undefined)).toBeUndefined()
    })
})
