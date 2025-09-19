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
    const ascending = input[1]! > input[0]!
    if (ascending) {
        if (x <= input[0]!) return 0
        for (let i = 1; i < input.length; i++) if (x <= input[i]!) return i - 1
        return input.length - 2
    } else {
        if (x >= input[0]!) return 0
        for (let i = 1; i < input.length; i++) if (x >= input[i]!) return i - 1
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
        throw new Error('useTransform: input and output arrays must be the same length')
    }
    const easings: Array<(t: number) => number> = Array.isArray(ease)
        ? ease
        : ease
          ? new Array(Math.max(0, out.length - 1)).fill(ease)
          : []
    return derived(source, (x) => {
        if (input.length === 0) return out[0] as T
        if (input.length === 1) return out[0] as T
        const seg = findSegment(input, x)
        const i0 = input[seg]!
        const i1 = input[seg + 1]!
        const o0 = out[seg]!
        const o1 = out[seg + 1]!
        const localClamp = clamp
            ? (val: number, a: number, b: number) =>
                  a < b ? Math.min(Math.max(val, a), b) : Math.min(Math.max(val, b), a)
            : (val: number) => val
        const progress = i0 === i1 ? 0 : (localClamp(x, i0, i1) - i0) / (i1 - i0)
        const e = easings[seg]
        const p = e ? e(progress) : progress
        const mix = mixer
            ? mixer(o0, o1)
            : typeof o0 === 'number' && typeof o1 === 'number'
              ? linearMix(o0, o1)
              : (_t: number) => (p < 0.5 ? o0 : o1)
        return mix(p) as T
    })
}
