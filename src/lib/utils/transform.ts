// Utilities for building and validating transform strings

export type TransformValues = Partial<{
    x: number
    y: number
    scale: number
    scaleX: number
    scaleY: number
    rotate: number
}>

const DEFAULTS: Required<TransformValues> = {
    x: 0,
    y: 0,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotate: 0
}

/** Build a CSS transform string from numeric values (no matrices). */
export function buildTransform(values: TransformValues): string {
    const v = { ...DEFAULTS, ...values }
    // If explicit per-axis scales provided, use them; otherwise use uniform scale
    const useAxes = values.scaleX !== undefined || values.scaleY !== undefined
    const parts: string[] = []
    // Translate first for readability; rely on browser to optimize
    if (v.x !== 0 || v.y !== 0) parts.push(`translate(${round(v.x)}px, ${round(v.y)}px)`)
    if (v.rotate !== 0) parts.push(`rotate(${round(v.rotate)}deg)`)
    if (useAxes) {
        parts.push(`scaleX(${round(v.scaleX)})`)
        parts.push(`scaleY(${round(v.scaleY)})`)
    } else if (v.scale !== 1) {
        parts.push(`scale(${round(v.scale)})`)
    }
    return parts.join(' ').trim()
}

/** Lightweight safety check for transform magnitudes and NaN values. */
export function isSafeTransform(values: TransformValues, opts?: { maxScale?: number }): boolean {
    const maxScale = opts?.maxScale ?? 8
    const entries: Array<[string, number | undefined]> = [
        ['scale', values.scale],
        ['scaleX', values.scaleX],
        ['scaleY', values.scaleY]
    ]
    for (const [, val] of entries) {
        if (val === undefined) continue
        if (!Number.isFinite(val)) return false
        if (Math.abs(val) > maxScale) return false
    }
    return true
}

export function parseMatrixScale(matrix: string | null | undefined): number | null {
    if (!matrix || matrix === 'none') return null
    const m = matrix.match(/matrix\(([^)]+)\)/)
    if (!m) return null
    const [a] = m[1].split(',').map((s) => parseFloat(s.trim()))
    return Number.isFinite(a) ? a : null
}

function round(n: number): number {
    // avoid excessive precision in strings
    return Math.round(n * 1e6) / 1e6
}

import { derived, readable, type Readable } from 'svelte/store'

/**
 * Options for range-mapping transform.
 *
 * - clamp: If true, clamps the input to the active segment bounds.
 * - ease: A single easing function or one per segment to shape interpolation.
 * - mixer: Custom mixer factory to interpolate non-numeric outputs.
 *
 * @see https://motion.dev/docs/react-use-transform?platform=react
 */
export type TransformOptions = {
    clamp?: boolean
    ease?: ((t: number) => number) | Array<(t: number) => number>
    mixer?: (from: unknown, to: unknown) => (t: number) => unknown
}

/**
 * Creates a linear mixer function for numeric values.
 *
 * @param from Starting numeric value.
 * @param to Ending numeric value.
 * @returns Function that linearly interpolates between from→to for progress t∈[0,1].
 * @private
 */
const linearMix = (from: number, to: number) => (t: number) => from + (to - from) * t

/**
 * Clamps a numeric value between two bounds, irrespective of their order.
 *
 * @param val Current value.
 * @param a First bound.
 * @param b Second bound.
 * @returns Value clamped to [min(a,b), max(a,b)].
 */
export const clampBidirectional = (val: number, a: number, b: number): number => {
    const lower = a < b ? a : b
    const upper = a < b ? b : a
    return Math.min(Math.max(val, lower), upper)
}

/**
 * Finds the segment index i such that x lies between input[i] and input[i+1].
 * Handles both ascending and descending input ranges.
 *
 * @param input Monotonic list of input stops.
 * @param x Current input value.
 * @returns Segment index in range [0, input.length - 2].
 * @private
 */
const findSegment = (input: number[], x: number): number => {
    if (input.length < 2) return 0
    const first = input[0]
    const second = input[1]
    const ascending = second > first
    if (ascending) {
        if (x <= first) return 0
        for (let i = 1; i < input.length; i++) {
            const curr = input[i]
            if (x <= curr) return i - 1
        }
        return input.length - 2
    } else {
        if (x >= first) return 0
        for (let i = 1; i < input.length; i++) {
            const curr = input[i]
            if (x >= curr) return i - 1
        }
        return input.length - 2
    }
}

/**
 * Creates a derived Svelte store that transforms values.
 *
 * Two supported forms (API parity with Motion's useTransform):
 * - Mapping form: Map a numeric source across input/output ranges.
 *   Example: `useTransform(src, [0, 100], [0, 1], { clamp: true })`
 * - Function form: Recompute from a function based on dependency stores.
 *   Example: `useTransform(() => compute(), [depA, depB])`
 *
 * @template T
 * @param {Readable<number>|(() => T)} sourceOrCompute Numeric source store (mapping form), or compute function (function form).
 * @param {number[]|Readable<unknown>[]} inputOrDeps Input stops (mapping) or dependency stores (function form).
 * @param {T[]=} output Output stops (mapping form only). Must match input length.
 * @param {TransformOptions=} options Mapping options (mapping form only).
 * @returns {Readable<T>} A derived Svelte readable store.
 * @see https://motion.dev/docs/react-use-transform?platform=react
 */
export const useTransform = <T = number>(
    sourceOrCompute: Readable<number> | (() => T),
    inputOrDeps: number[] | Readable<unknown>[],
    output?: T[],
    options: TransformOptions = {}
): Readable<T> => {
    // Function form: (compute, deps)
    if (typeof sourceOrCompute === 'function') {
        const compute = sourceOrCompute as () => T
        const deps = inputOrDeps as Readable<unknown>[]
        if (!deps || deps.length === 0) return readable(compute())
        return derived(deps, () => compute())
    }
    // Mapping form: (source, input, output, options)
    const source = sourceOrCompute as Readable<number>
    const input = inputOrDeps as number[]
    const out = (output ?? []) as T[]
    const { clamp = true, ease, mixer } = options
    if (input.length !== out.length) {
        throw new Error(
            `useTransform: input and output arrays must be the same length (input: ${input.length}, output: ${out.length})`
        )
    }
    const easings: Array<(_t: number) => number> = Array.isArray(ease)
        ? ease
        : ease
          ? new Array(Math.max(0, out.length - 1)).fill(ease)
          : []
    return derived(source, (x) => {
        if (input.length === 0) return out[0] as T
        if (input.length === 1) return out[0] as T
        const seg = findSegment(input, x)
        const i0 = input[seg]
        const i1 = input[seg + 1]
        const o0 = out[seg]
        const o1 = out[seg + 1]

        // Runtime validation to avoid non-null assertions
        if (i0 === undefined || i1 === undefined || o0 === undefined || o1 === undefined) {
            console.warn('useTransform: Invalid segment bounds', {
                seg,
                inputLength: input.length,
                outputLength: out.length
            })
            return out[0] as T
        }
        const localClamp = clamp ? clampBidirectional : (val: number) => val
        const progress = i0 === i1 ? 0 : (localClamp(x, i0, i1) - i0) / (i1 - i0)
        const e = easings[seg]
        const p = e ? e(progress) : progress
        const mix = mixer
            ? mixer(o0, o1)
            : typeof o0 === 'number' && typeof o1 === 'number'
              ? linearMix(o0, o1)
              : (_t: number) => (p < 0.5 ? o0 : o1) // trunk-ignore(eslint/@typescript-eslint/no-unused-vars)
        return mix(p) as T
    })
}
