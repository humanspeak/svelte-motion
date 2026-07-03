// Utilities for building and validating transform strings

import { type MotionValue, type TransformOptions } from 'motion-dom'
import { type AugmentedMotionValue } from './augmentMotionValue.svelte.js'
import { resolveMotionValueSource, type MotionValueSource } from './toMotionValue.svelte.js'
import {
    mapValue as createMapValue,
    transformValue as createTransformValue
} from './vanillaValues.svelte.js'

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
 *
 * @example
 * ```ts
 * buildTransform({ x: 10, y: 20, scale: 1.5 })
 * // => "translate(10px, 20px) scale(1.5)"
 *
 * buildTransform({ x: 0, y: 0, rotate: 0 }) // all defaults
 * // => ""
 * ```
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
 *
 * @example
 * ```ts
 * isSafeTransform({ scale: 2 })                  // true
 * isSafeTransform({ scale: 100 })                // false (exceeds default maxScale=8)
 * isSafeTransform({ scale: 100 }, { maxScale: 200 })  // true
 * isSafeTransform({ scale: NaN })                // false
 * ```
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
 *
 * @example
 * ```ts
 * parseMatrixScale('matrix(1.5, 0, 0, 1.5, 0, 0)')  // 1.5
 * parseMatrixScale('none')                          // null
 * parseMatrixScale(null)                            // null
 * ```
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

// Re-export motion-dom's TransformOptions so consumers don't have to import
// from two packages.
export type { TransformOptions }

/**
 * Any motion-value shape this library accepts as a transform input: the raw
 * motion-dom `MotionValue<T>` and our augmented `AugmentedMotionValue<T>` are
 * both runtime-identical (the augmentation is a Svelte 5 retype, not a
 * subclass), but TypeScript's private-field nominal typing means the two
 * aren't structurally assignable in public signatures. This alias accepts
 * both so call sites compile cleanly.
 */
export type AnyMotionValue<T> = MotionValue<T> | AugmentedMotionValue<T>

/**
 * A source for {@link useTransform}'s mapping form: any motion value, a
 * Svelte readable store, or a reactive getter (`$state` / `$derived`
 * reads inside it are tracked). Extends {@link MotionValueSource} with
 * the augmented value shape so both flavors type-check at call sites;
 * non-motion-value sources are bridged internally (via
 * `resolveMotionValueSource`) so motion-dom can track them.
 */
export type TransformSource<T> = AugmentedMotionValue<T> | MotionValueSource<T>

/**
 * Single-input transformer signature: `(latest) => output`.
 */
export type SingleTransformer<I, O> = (input: I) => O
/**
 * Multi-input transformer signature: `([latestA, latestB, ...]) => output`.
 */
export type MultiTransformer<I, O> = (inputs: I[]) => O

/**
 * Output map for the multi-output mapping form: `{ key: [stop, …] }`. The
 * keys are stable per call and each entry produces its own `MotionValue`.
 */
export type TransformOutputMap<O> = { [key: string]: O[] }

/**
 * Creates an augmented `MotionValue<O>` derived from one or more `MotionValue`s
 * (or Svelte readables / reactive getters), composed via a range mapping or a
 * compute function.
 *
 * Mirrors framer-motion's `useTransform` 1:1 with five forms:
 *
 * - **Mapping form** — `useTransform(source, input, output, options?)` maps a
 *   numeric source's value across `input → output` stops with clamp, easing,
 *   and a pluggable mixer for non-numeric outputs. The source may be a motion
 *   value, a Svelte readable, or a reactive getter (`$state` / `$derived`
 *   reads inside it are tracked). Delegates to motion-dom's `mapValue`.
 * - **Multi-output mapping form** — `useTransform(source, input, outputMap, options?)`
 *   produces an object of motion values, one per key in `outputMap`. Each
 *   value is the same mapping form applied to that key's output stops; all
 *   keys share one source bridge.
 * - **Single-transformer form** — `useTransform(source, (latest) => O)`
 *   recomputes on every change of the source (motion value, readable, or
 *   getter). Auto-tracks via `transformValue`.
 * - **Multi-transformer form** — `useTransform([mv1, mv2, …], ([latest, …]) => O)`
 *   recomputes on every change of any input. Auto-tracks via `transformValue`.
 * - **Compute form** — `useTransform(() => compute)` recomputes whenever any
 *   `MotionValue` referenced inside `compute` via `.get()` changes.
 *   Auto-tracks via `transformValue` — no explicit deps array; the
 *   `collectMotionValues` session inside `transformValue` discovers them.
 *
 * Dispatch rule for functions: a BARE function argument is the compute form;
 * a function accompanied by range/transformer arguments is a reactive getter
 * SOURCE for the other forms.
 *
 * Returns an {@link AugmentedMotionValue<O>} — a real motion-dom `MotionValue`
 * (composes with `useSpring`, `useVelocity`, `animate()`, etc.) plus a
 * `$state`-backed `.current` getter and a Svelte readable `.subscribe` shim.
 *
 * Lifecycle: must be called during component initialization. Source
 * subscriptions, the underlying motion value, and any readable/getter bridges
 * are torn down when the surrounding `$effect` scope unmounts.
 *
 * @template O Output value type.
 * @param sourceOrCompute A motion value / readable / reactive getter (mapping
 *   and single-transformer forms), an array of `MotionValue`s
 *   (multi-transformer form), or a bare compute function (compute form).
 * @param inputOrTransformer Input stops `number[]` (mapping forms) or a
 *   transformer function (`(latest) => O` / `(latest[]) => O`).
 * @param outputOrOutputMap Output stops `O[]` (single-output mapping) or an
 *   output map `{ [key]: O[] }` (multi-output mapping).
 * @param options Optional `TransformOptions` — `clamp`, `ease`, `mixer`.
 * @returns An `AugmentedMotionValue<O>` for single-output forms, or an object
 *   of motion values keyed by `outputMap` for the multi-output form.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useMotionValue, useTransform } from '@humanspeak/svelte-motion'
 *
 *   const x = useMotionValue(0)
 *
 *   // Mapping form
 *   const opacity = useTransform(x, [0, 100], [0, 1])
 *
 *   // Single-MV transformer
 *   const doubled = useTransform(x, (latest) => latest * 2)
 *
 *   // Compute form — auto-tracks via collectMotionValues
 *   const y = useMotionValue(0)
 *   const sum = useTransform(() => x.get() + y.get())
 *
 *   // Multi-output mapping
 *   const { rotate, scale } = useTransform(x, [0, 100], {
 *     rotate: [0, 360],
 *     scale: [1, 2]
 *   })
 * </script>
 *
 * <div style="opacity: {opacity.current}; transform: rotate({rotate.current}deg) scale({scale.current})">
 *   {sum.current}
 * </div>
 * ```
 *
 * @see https://motion.dev/docs/react-use-transform
 */
// Project convention: exported helpers use arrow syntax. `useTransform` is a
// documented exception — the five-form public API is expressed via
// TypeScript overload signatures, which require `function` declarations
// (overload syntax doesn't work on `const` arrow assignments).
export function useTransform<O>(
    source: TransformSource<number>,
    input: number[],
    output: O[],
    options?: TransformOptions<O>
): AugmentedMotionValue<O>
export function useTransform<T extends TransformOutputMap<unknown>>(
    source: TransformSource<number>,
    input: number[],
    outputMap: T,
    options?: TransformOptions<T[keyof T][number]>
): { [K in keyof T]: AugmentedMotionValue<T[K][number]> }
export function useTransform<I, O>(
    source: TransformSource<I>,
    transformer: SingleTransformer<I, O>
): AugmentedMotionValue<O>
export function useTransform<I, O>(
    sources: ReadonlyArray<AnyMotionValue<I>>,
    transformer: MultiTransformer<I, O>
): AugmentedMotionValue<O>
export function useTransform<O>(compute: () => O): AugmentedMotionValue<O>
export function useTransform<O>(
    sourceOrCompute:
        | TransformSource<number>
        | AnyMotionValue<unknown>
        | ReadonlyArray<AnyMotionValue<unknown>>
        | (() => O),
    inputOrTransformer?: number[] | SingleTransformer<unknown, O> | MultiTransformer<unknown, O>,
    outputOrOutputMap?: O[] | TransformOutputMap<unknown>,
    options?: TransformOptions<unknown>
): AugmentedMotionValue<O> | { [key: string]: AugmentedMotionValue<O> } {
    // Compute form: useTransform(() => compute). A bare function with NO
    // range arguments — a function WITH ranges is a getter SOURCE for the
    // mapping forms below.
    if (typeof sourceOrCompute === 'function' && inputOrTransformer === undefined) {
        const value = createTransformValue<O>(sourceOrCompute as () => O)
        $effect(() => () => value.destroy())
        return value
    }

    // Multi-input list form: useTransform([mv, mv, …], ([a, b, …]) => O).
    if (Array.isArray(sourceOrCompute) && typeof inputOrTransformer === 'function') {
        const sources = sourceOrCompute as ReadonlyArray<AnyMotionValue<unknown>>
        const transformer = inputOrTransformer as MultiTransformer<unknown, O>
        const value = createTransformValue<O>(() => {
            const latest: unknown[] = []
            for (let i = 0; i < sources.length; i++) {
                latest.push(sources[i].get())
            }
            return transformer(latest)
        })
        $effect(() => () => value.destroy())
        return value
    }

    // Single-source transformer form: useTransform(source, (latest) => O).
    // Resolved through the shared source machinery so readable/getter
    // sources work here just like in the mapping forms — without this,
    // an untyped getter call would crash on `source.get`.
    if (typeof inputOrTransformer === 'function') {
        const { value: source, dispose } = resolveMotionValueSource(
            sourceOrCompute as MotionValueSource<unknown>
        )
        const transformer = inputOrTransformer as SingleTransformer<unknown, O>
        const value = createTransformValue<O>(() => transformer(source.get()))
        $effect(() => () => {
            value.destroy()
            dispose()
        })
        return value
    }

    const source = sourceOrCompute as TransformSource<number>
    const input = (inputOrTransformer as number[]) ?? []

    // Multi-output mapping form: useTransform(source, [range], { key: [out], … }, options).
    // The `outputOrOutputMap !== null` check is load-bearing — `typeof null`
    // is `'object'`, so a `null` argument would otherwise enter this branch
    // and crash at `Object.keys(null)`.
    if (
        outputOrOutputMap !== undefined &&
        outputOrOutputMap !== null &&
        !Array.isArray(outputOrOutputMap) &&
        typeof outputOrOutputMap === 'object'
    ) {
        // Resolve the source ONCE so all keys share a single bridge (a
        // readable/getter source must not be subscribed per key).
        const { value: numericSource, dispose: disposeBridge } = resolveMotionValueSource(
            source as MotionValueSource<number>
        )
        const outputMap = outputOrOutputMap as TransformOutputMap<O>
        const keys = Object.keys(outputMap)
        const result: { [key: string]: AugmentedMotionValue<O> } = {}
        for (const key of keys) {
            result[key] = createMapValue(
                numericSource,
                input,
                outputMap[key],
                options as TransformOptions<O> | undefined
            )
        }
        // One cleanup effect for all per-key MVs plus the shared bridge —
        // saves N effect nodes vs. registering one per key.
        $effect(() => () => {
            for (const key of keys) result[key].destroy()
            disposeBridge()
        })
        return result
    }

    // Single-output mapping form: useTransform(source, [range], [out], options).
    // The vanilla factory resolves the source (bridging readables/getters)
    // and chains that bridge's teardown onto the value's own destroy.
    const output = (outputOrOutputMap as O[]) ?? []
    const value = createMapValue(
        source as MotionValueSource<number>,
        input,
        output,
        options as TransformOptions<O> | undefined
    )
    $effect(() => () => value.destroy())
    return value
}
