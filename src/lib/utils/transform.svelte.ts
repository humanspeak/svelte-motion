// Utilities for building and validating transform strings

import { motionValue } from 'motion-dom'
import { type Readable } from 'svelte/store'
import {
    augmentMotionValue,
    sampleSource,
    subscribeAfterInitial,
    type AugmentedMotionValue
} from './augmentMotionValue.svelte.js'

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

/**
 * Build a CSS transform string from numeric values (no matrices).
 *
 * @param values Partial map of translate/scale/rotate values.
 * @returns A space-separated CSS `transform` string, or `""` when all values are defaults.
 */
export const buildTransform = (values: TransformValues): string => {
    const v = { ...DEFAULTS, ...values }
    const useAxes = values.scaleX !== undefined || values.scaleY !== undefined
    const parts: string[] = []
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

/**
 * Lightweight safety check for transform magnitudes and NaN values.
 *
 * @param values Transform values to validate.
 * @param opts Optional configuration; `maxScale` caps allowable absolute scale (default 8).
 * @returns `true` if all scale values are finite and within bounds.
 */
export const isSafeTransform = (values: TransformValues, opts?: { maxScale?: number }): boolean => {
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

/**
 * Extract the uniform scale factor from a CSS `matrix()` string.
 *
 * @param matrix A CSS `matrix(...)` value, `"none"`, `null`, or `undefined`.
 * @returns The `a` component of the matrix (uniform scale), or `null` if unparseable.
 */
export const parseMatrixScale = (matrix: string | null | undefined): number | null => {
    if (!matrix || matrix === 'none') return null
    const m = matrix.match(/matrix\(([^)]+)\)/)
    if (!m) return null
    const [a] = m[1].split(',').map((s) => parseFloat(s.trim()))
    return Number.isFinite(a) ? a : null
}

/**
 * Round a number to six decimal places to avoid excessive precision in CSS strings.
 *
 * @param n The number to round.
 * @returns The rounded value.
 */
const round = (n: number): number => {
    return Math.round(n * 1e6) / 1e6
}

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
 * A source for {@link useTransform}'s mapping form: a motion-dom `MotionValue`
 * (via `useMotionValue`, `useSpring`, or any other Tier 2 hook) or a Svelte
 * readable store. Both expose `.subscribe(run)` with the same contract, so
 * `useTransform` consumes them interchangeably.
 */
export type TransformSource<T> =
    | (Readable<T> & { get?: () => T })
    | AugmentedMotionValue<T>
    | Readable<T>

/**
 * Picks the mixer for a single segment: user-supplied mixer factory wins;
 * a numeric pair falls back to linear interpolation; mixed-type or
 * non-numeric endpoints snap from `o0` to `o1` at the segment midpoint. The
 * snap fallback uses its own `t` parameter (not a closure over outer
 * `progress`) so callers can safely store and re-invoke the returned mixer.
 */
const pickMixer = <T>(o0: T, o1: T, mixer: TransformOptions['mixer']): ((t: number) => T) => {
    if (mixer) return mixer(o0, o1) as (t: number) => T
    if (typeof o0 === 'number' && typeof o1 === 'number') {
        return linearMix(o0, o1) as unknown as (t: number) => T
    }
    return (t: number) => (t < 0.5 ? o0 : o1)
}

/**
 * Builds a single-segment mapper for the mapping form. Encapsulates clamp,
 * ease, mixer selection, and the linear-progress math. Used per change of
 * the source.
 */
const buildMapper = <T>(
    input: number[],
    out: T[],
    options: TransformOptions
): ((x: number) => T) => {
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
    return (x: number): T => {
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
        const mix = pickMixer(o0, o1, mixer)
        return mix(p) as T
    }
}

/**
 * Creates a motion-dom `MotionValue<T>` whose value is derived from another
 * motion value (or Svelte readable) via a range mapping or a compute function.
 *
 * Two supported forms (API parity with framer-motion's `useTransform`):
 *
 * - **Mapping form** — `useTransform(source, input, output, options)`. Maps a
 *   numeric source's value across `input → output` stops with clamp, easing,
 *   and a pluggable mixer for non-numeric outputs.
 * - **Function form** — `useTransform(() => compute, deps)`. Recomputes from
 *   a function on every emit of any dep (either a `MotionValue` or a Svelte
 *   readable).
 *
 * Returns an {@link AugmentedMotionValue} — a real motion-dom `MotionValue`
 * (so it composes with `useTransform`, `useSpring`, `animate()`, etc.) plus
 * a Svelte 5 reactive `.current` getter and a `.subscribe` shim. The internal
 * subscription to the source / deps is established eagerly so `.current`
 * stays live even when nothing else is consuming the value.
 *
 * Lifecycle: must be called during component initialization. All source
 * subscriptions are released and the underlying `MotionValue` destroyed when
 * the surrounding `$effect` scope tears down.
 *
 * @template T Output value type.
 * @returns {AugmentedMotionValue<T>} A `MotionValue<T>` with `.current` and `.subscribe`.
 * @see https://motion.dev/docs/react-use-transform
 */
export function useTransform<T = number>(
    source: TransformSource<number>,
    input: number[],
    output: T[],
    options?: TransformOptions
): AugmentedMotionValue<T>
export function useTransform<T = number>(
    compute: () => T,
    deps: Array<TransformSource<unknown>>
): AugmentedMotionValue<T>
export function useTransform<T = number>(
    sourceOrCompute: TransformSource<number> | (() => T),
    inputOrDeps: number[] | Array<TransformSource<unknown>>,
    output?: T[],
    options: TransformOptions = {}
): AugmentedMotionValue<T> {
    // Function form: (compute, deps)
    if (typeof sourceOrCompute === 'function') {
        const compute = sourceOrCompute as () => T
        const deps = (inputOrDeps as Array<TransformSource<unknown>>) ?? []
        const value = motionValue<T>(compute())
        const unsubs = deps.map((dep) => subscribeAfterInitial(dep, () => value.set(compute())))
        const dispose = () => {
            for (const off of unsubs) off()
        }
        $effect(() => () => value.destroy())
        return augmentMotionValue(value, dispose)
    }

    // Mapping form: (source, input, output, options)
    const source = sourceOrCompute as TransformSource<number>
    const input = inputOrDeps as number[]
    const out = (output ?? []) as T[]
    const map = buildMapper(input, out, options)

    const value = motionValue<T>(map(sampleSource(source)))
    const unsub = subscribeAfterInitial(source, (x) => value.set(map(x)))

    $effect(() => () => value.destroy())
    return augmentMotionValue(value, unsub)
}
