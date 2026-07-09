import type { Variants } from '$lib/types'
import { describe, expect, it } from 'vitest'
import {
    resolveAnimate,
    resolveExit,
    resolveInitial,
    resolveRestingValues,
    resolveVariant,
    resolveVariantList,
    resolveWhile
} from './variants.js'

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

    it('does not resolve inherited / prototype keys like "toString" or "constructor"', () => {
        // Without the `hasOwnProperty` guard, `variants['toString']`
        // would walk up to `Function.prototype.toString` and leak a
        // function into the merge path — a real bug for users who name
        // a variant after a built-in. (#349 CR)
        const variants: Variants = { real: { opacity: 1 } }
        expect(resolveVariant(variants, 'toString')).toBeUndefined()
        expect(resolveVariant(variants, 'constructor')).toBeUndefined()
        expect(resolveVariant(variants, 'hasOwnProperty')).toBeUndefined()
        // The real key still resolves.
        expect(resolveVariant(variants, 'real')).toEqual({ opacity: 1 })
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

    it('resolves an array-form initial via resolveVariantList (later wins)', () => {
        const variants: Variants = {
            hidden: { opacity: 0, scale: 0.5 },
            small: { scale: 0.8 }
        }
        expect(resolveInitial(['hidden', 'small'], variants)).toEqual({
            opacity: 0,
            scale: 0.8
        })
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

    it('resolves an array-form animate via resolveVariantList (later wins)', () => {
        const variants: Variants = {
            visible: { opacity: 1, x: 0 },
            shifted: { x: 100 }
        }
        expect(resolveAnimate(['visible', 'shifted'], variants)).toEqual({
            opacity: 1,
            x: 100
        })
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
            hidden: (direction) => ({ x: (direction as number) > 0 ? 200 : -200 })
        }
        expect(resolveExit('hidden', variants, 1)).toEqual({ x: 200 })
        expect(resolveExit('hidden', variants, -1)).toEqual({ x: -200 })
    })

    it('returns undefined when exit is undefined', () => {
        expect(resolveExit(undefined, undefined)).toBeUndefined()
    })

    it('resolves an array of variant keys by merging keyframes left-to-right', () => {
        const variants: Variants = {
            hidden: { opacity: 0, scale: 0.5 },
            small: { scale: 0.8 }
        }
        // `small` is later in the array → its `scale` wins; `opacity`
        // from `hidden` is preserved.
        expect(resolveExit(['hidden', 'small'], variants)).toEqual({
            opacity: 0,
            scale: 0.8
        })
    })
})

describe('utils/variants - resolveVariantList', () => {
    it('returns undefined when keys is undefined', () => {
        expect(resolveVariantList({ a: { x: 1 } }, undefined)).toBeUndefined()
    })

    it('returns undefined for an empty array', () => {
        expect(resolveVariantList({ a: { x: 1 } }, [])).toBeUndefined()
    })

    it('delegates to resolveVariant for a single string', () => {
        const variants: Variants = { hover: { scale: 1.1 } }
        expect(resolveVariantList(variants, 'hover')).toEqual({ scale: 1.1 })
    })

    it('merges multiple variant keys left-to-right, later wins on collisions', () => {
        const variants: Variants = {
            hover: { scale: 1.1, color: 'blue' },
            active: { scale: 1.2 }
        }
        expect(resolveVariantList(variants, ['hover', 'active'])).toEqual({
            scale: 1.2,
            color: 'blue'
        })
    })

    it('skips missing keys without breaking the chain', () => {
        const variants: Variants = { hover: { scale: 1.1 } }
        expect(resolveVariantList(variants, ['missing', 'hover'])).toEqual({ scale: 1.1 })
        expect(resolveVariantList(variants, ['hover', 'missing'])).toEqual({ scale: 1.1 })
    })

    it('returns undefined when every key in the array misses', () => {
        const variants: Variants = { hover: { scale: 1.1 } }
        expect(resolveVariantList(variants, ['none', 'missing'])).toBeUndefined()
    })

    it('forwards custom to function-form entries per-key', () => {
        const variants: Variants = {
            base: (i) => ({ x: (i as number) * 10 }),
            delta: (i) => ({ y: (i as number) * 5 })
        }
        expect(resolveVariantList(variants, ['base', 'delta'], 4)).toEqual({
            x: 40,
            y: 20
        })
    })

    it('rejects non-plain-object entries (arrays, class instances) from the merge', () => {
        // A function-form variant could misbehave and return an array
        // or class instance. Spreading those would corrupt the merge
        // (array indices as keys, methods leaking in). Skip them.
        class CustomShape {
            constructor(public x: number) {}
        }
        // Cast to `Variants` — the `Variant` factory signature expects
        // plain keyframes; we are deliberately misusing it to verify
        // the runtime guard catches what TypeScript would normally
        // forbid.
        const variants = {
            badArray: () => [1, 2, 3],
            badInstance: () => new CustomShape(5),
            good: { opacity: 1 }
        } as unknown as Variants

        // Arrays alone → undefined (nothing valid merged)
        expect(resolveVariantList(variants, ['badArray'])).toBeUndefined()
        // Class instances alone → undefined
        expect(resolveVariantList(variants, ['badInstance'])).toBeUndefined()
        // Mixed: the good entry still applies, bad entries skipped
        expect(resolveVariantList(variants, ['badArray', 'good', 'badInstance'])).toEqual({
            opacity: 1
        })
    })

    it('accepts Object.create(null) entries from the merge (prototype === null)', () => {
        // Sanity check: a function-form variant building keyframes via
        // `Object.create(null)` is still a plain map. Don't reject it.
        const variants = {
            nullProto: () => {
                const obj = Object.create(null)
                obj.scale = 1.5
                return obj
            }
        } as unknown as Variants
        expect(resolveVariantList(variants, ['nullProto'])).toEqual({ scale: 1.5 })
    })
})

describe('utils/variants - resolveWhile', () => {
    it('passes through inline keyframes unchanged', () => {
        expect(resolveWhile({ scale: 1.1 }, undefined)).toEqual({ scale: 1.1 })
    })

    it('resolves a single variant key', () => {
        const variants: Variants = { hover: { scale: 1.05 } }
        expect(resolveWhile('hover', variants)).toEqual({ scale: 1.05 })
    })

    it('resolves an array of variant keys with later-wins merging', () => {
        const variants: Variants = {
            hover: { scale: 1.1 },
            active: { scale: 1.2, color: 'red' }
        }
        expect(resolveWhile(['hover', 'active'], variants)).toEqual({
            scale: 1.2,
            color: 'red'
        })
    })

    it('returns undefined when value is undefined', () => {
        expect(resolveWhile(undefined, undefined)).toBeUndefined()
    })

    it('returns undefined when the variant key misses', () => {
        const variants: Variants = { hover: { scale: 1.1 } }
        expect(resolveWhile('missing', variants)).toBeUndefined()
    })

    it('forwards custom to function-form variants', () => {
        const variants: Variants = {
            hover: (i) => ({ scale: 1 + (i as number) * 0.1 })
        }
        expect(resolveWhile('hover', variants, 3)).toEqual({ scale: 1.3 })
    })
})

describe('utils/variants - resolveRestingValues', () => {
    it('collapses a keyframe array to its last element (the resting value)', () => {
        expect(resolveRestingValues({ x: [0, 100, 50] })).toEqual({ x: 50 })
    })

    it('leaves scalar values untouched', () => {
        expect(resolveRestingValues({ opacity: 0.5, scaleX: 1 })).toEqual({
            opacity: 0.5,
            scaleX: 1
        })
    })

    it('handles a mix of scalars and arrays', () => {
        expect(resolveRestingValues({ x: [0, 120, 60], rotate: 45, scaleY: [0, 1] })).toEqual({
            x: 60,
            rotate: 45,
            scaleY: 1
        })
    })

    it('omits keys whose value is an empty array (no resting value)', () => {
        expect(resolveRestingValues({ x: [], y: 5 })).toEqual({ y: 5 })
        expect(resolveRestingValues({ x: [] })).toEqual({})
    })

    it('returns undefined when given undefined', () => {
        expect(resolveRestingValues(undefined)).toBeUndefined()
    })

    it('returns a new object (does not mutate the input)', () => {
        const input = { x: [0, 50] } as never
        const out = resolveRestingValues(input)
        expect(out).not.toBe(input)
        expect((input as { x: number[] }).x).toEqual([0, 50])
    })
})
