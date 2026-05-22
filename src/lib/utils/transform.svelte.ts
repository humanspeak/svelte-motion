// Utilities for building and validating transform strings

import {
    isMotionValue,
    mapValue,
    motionValue,
    transformValue,
    type MotionValue,
    type TransformOptions
} from 'motion-dom'
import { get, type Readable } from 'svelte/store'
import { augmentMotionValue, type AugmentedMotionValue } from './augmentMotionValue.svelte.js'

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
 * A source for {@link useTransform}'s mapping form: any motion value or a
 * Svelte readable store. Svelte readables are bridged into a `MotionValue`
 * internally so motion-dom's `mapValue` / `transformValue` can track them.
 */
export type TransformSource<T> = AnyMotionValue<T> | Readable<T>

/**
 * Bridges a `Readable<T>` into a motion-dom `MotionValue<T>` that mirrors the
 * readable's emissions. Returns the bridge value plus a `dispose` cleanup that
 * tears down the subscription and destroys the bridge.
 *
 * The bridge skips the readable's synchronous initial emit (the value is
 * already seeded from `get(source)`) so motion-dom's change-bus doesn't fire
 * a spurious event on attach.
 */
const bridgeReadable = <T>(
    source: Readable<T>
): { value: MotionValue<T>; dispose: VoidFunction } => {
    const bridge = motionValue<T>(get(source) as T)
    let seenInitial = false
    const unsub = source.subscribe((v) => {
        if (!seenInitial) {
            seenInitial = true
            return
        }
        bridge.set(v)
    })
    return {
        value: bridge,
        dispose: () => {
            unsub()
            bridge.destroy()
        }
    }
}

/**
 * Normalizes a `TransformSource<T>` into a `MotionValue<T>`. Returns the
 * source as-is for any motion-value input (no bridge), or a fresh bridge
 * `MotionValue` plus a cleanup for `Readable` inputs. The cast at the
 * motion-value branch is safe — both `MotionValue` and `AugmentedMotionValue`
 * are the same instance at runtime.
 */
const toMotionValue = <T>(
    source: TransformSource<T>
): { value: MotionValue<T>; dispose: VoidFunction } => {
    if (isMotionValue(source)) {
        return { value: source as unknown as MotionValue<T>, dispose: () => undefined }
    }
    return bridgeReadable(source as Readable<T>)
}

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
 * (or Svelte readables), composed via a range mapping or a compute function.
 *
 * Mirrors framer-motion's `useTransform` 1:1 with five forms:
 *
 * - **Mapping form** — `useTransform(source, input, output, options?)` maps a
 *   numeric source's value across `input → output` stops with clamp, easing,
 *   and a pluggable mixer for non-numeric outputs. Delegates to motion-dom's
 *   `mapValue` (which is itself `transformValue` over the curried mapper).
 * - **Multi-output mapping form** — `useTransform(source, input, outputMap, options?)`
 *   produces an object of motion values, one per key in `outputMap`. Each
 *   value is the same mapping form applied to that key's output stops.
 * - **Single-transformer form** — `useTransform(mv, (latest) => O)` recomputes
 *   on every change of `mv`. Auto-tracks via `transformValue`.
 * - **Multi-transformer form** — `useTransform([mv1, mv2, …], ([latest, …]) => O)`
 *   recomputes on every change of any input. Auto-tracks via `transformValue`.
 * - **Compute form** — `useTransform(() => compute)` recomputes whenever any
 *   `MotionValue` referenced inside `compute` (via `.get()` or `.current`)
 *   changes. Auto-tracks via `transformValue` — no explicit deps array; the
 *   `collectMotionValues` session inside `transformValue` discovers them.
 *
 * Returns an {@link AugmentedMotionValue<O>} — a real motion-dom `MotionValue`
 * (composes with `useSpring`, `useVelocity`, `animate()`, etc.) plus a
 * `$state`-backed `.current` getter and a Svelte readable `.subscribe` shim.
 *
 * Lifecycle: must be called during component initialization. Source
 * subscriptions, the underlying motion value, and any Svelte-readable bridges
 * are torn down when the surrounding `$effect` scope unmounts.
 *
 * @see https://motion.dev/docs/react-use-transform
 */
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
    source: AnyMotionValue<I>,
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
    // Compute form: useTransform(() => compute).
    if (typeof sourceOrCompute === 'function') {
        const compute = sourceOrCompute as () => O
        const value = transformValue<O>(compute)
        $effect(() => () => value.destroy())
        return augmentMotionValue(value)
    }

    // Multi-input list form: useTransform([mv, mv, …], ([a, b, …]) => O).
    if (Array.isArray(sourceOrCompute) && typeof inputOrTransformer === 'function') {
        const sources = sourceOrCompute as ReadonlyArray<AnyMotionValue<unknown>>
        const transformer = inputOrTransformer as MultiTransformer<unknown, O>
        const value = transformValue<O>(() => {
            const latest: unknown[] = []
            for (let i = 0; i < sources.length; i++) {
                latest.push((sources[i] as unknown as MotionValue<unknown>).get())
            }
            return transformer(latest)
        })
        $effect(() => () => value.destroy())
        return augmentMotionValue(value)
    }

    // Single-MV transformer form: useTransform(mv, (latest) => O).
    if (typeof inputOrTransformer === 'function') {
        const source = sourceOrCompute as unknown as MotionValue<unknown>
        const transformer = inputOrTransformer as SingleTransformer<unknown, O>
        const value = transformValue<O>(() => transformer(source.get()))
        $effect(() => () => value.destroy())
        return augmentMotionValue(value)
    }

    // Mapping forms (single output array or output map).
    const source = sourceOrCompute as TransformSource<number>
    const input = (inputOrTransformer as number[]) ?? []
    const { value: numericSource, dispose: disposeBridge } = toMotionValue(source)

    // Multi-output mapping form: useTransform(source, [range], { key: [out], … }, options).
    if (
        outputOrOutputMap !== undefined &&
        !Array.isArray(outputOrOutputMap) &&
        typeof outputOrOutputMap === 'object'
    ) {
        const outputMap = outputOrOutputMap as TransformOutputMap<unknown>
        const keys = Object.keys(outputMap)
        const result: { [key: string]: AugmentedMotionValue<O> } = {}
        for (const key of keys) {
            const inner = mapValue<unknown>(
                numericSource,
                input,
                outputMap[key],
                options as TransformOptions<unknown> | undefined
            )
            $effect(() => () => inner.destroy())
            result[key] = augmentMotionValue(inner) as unknown as AugmentedMotionValue<O>
        }
        $effect(() => () => disposeBridge())
        return result
    }

    // Single-output mapping form: useTransform(source, [range], [out], options).
    const output = (outputOrOutputMap as O[]) ?? []
    const value = mapValue<O>(
        numericSource,
        input,
        output,
        options as TransformOptions<O> | undefined
    )
    $effect(() => () => {
        value.destroy()
        disposeBridge()
    })
    return augmentMotionValue(value)
}
