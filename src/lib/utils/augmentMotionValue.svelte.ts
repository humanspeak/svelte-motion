import { isMotionValue, motionValue, type MotionValue } from 'motion-dom'
import { get, type Readable } from 'svelte/store'

/**
 * A motion-dom `MotionValue<T>` augmented with the two affordances every
 * Tier-2 hook in this library exposes for Svelte 5 consumers:
 *
 * - `current` — a `$state`-backed reactive getter. Reads inside templates,
 *   `$derived`, and `$effect` track changes automatically without going
 *   through `.subscribe()`.
 * - `subscribe(run)` — Svelte readable store contract. Calls `run(value)`
 *   once synchronously on subscribe, then on every change. Lets the same
 *   value drive `$value` template syntax, `svelte/store`'s `get()`, and
 *   anything else that expects a readable.
 *
 * Every Wave 3 hook (`useMotionValue`, `useTransform`, `useScroll`,
 * `useTime`, `useVelocity`, `useMotionTemplate`) and `useSpring` returns a
 * value of this shape. The point is to keep one shared surface across all
 * motion-value-producing hooks instead of repeating the wiring in each.
 */
export type AugmentedMotionValue<T> = Omit<MotionValue<T>, 'current'> & {
    /** Reactive read in Svelte 5 templates / `$derived` / `$effect`. */
    readonly current: T
    /** Svelte readable store compatibility. */
    subscribe: (run: (value: T) => void) => () => void
}

/**
 * Detects a Svelte readable store, excluding motion-dom `MotionValue`
 * instances (which also expose `subscribe`-shaped APIs in some versions).
 * Used by hook factories that accept either a `MotionValue` or a readable
 * store as a source.
 *
 * @template T The value type the readable emits.
 * @param value Any value to test.
 * @returns Whether the value is a Svelte readable (and not a `MotionValue`).
 *
 * @example
 * ```ts
 * import { writable } from 'svelte/store'
 * import { motionValue } from 'motion-dom'
 *
 * isSvelteReadable(writable(0))  // true
 * isSvelteReadable(motionValue(0))  // false (a MotionValue, not a readable)
 * isSvelteReadable({ subscribe: 'nope' })  // false (subscribe isn't callable)
 * ```
 */
export const isSvelteReadable = <T = unknown>(value: unknown): value is Readable<T> => {
    return (
        !!value &&
        typeof value === 'object' &&
        typeof (value as { subscribe?: unknown }).subscribe === 'function' &&
        !isMotionValue(value)
    )
}

/**
 * Synchronously samples a source: returns `T` directly, calls `.get()` on
 * a `MotionValue`, or `svelte/store`'s `get()` on a readable. Used by hook
 * factories to seed an initial value before any subscription is established.
 *
 * @template T The value type.
 * @param source A plain value, a `MotionValue`, or a Svelte readable.
 * @returns The current value of the source.
 *
 * @example
 * ```ts
 * sampleSource(42)               // 42
 * sampleSource(motionValue(7))   // 7
 * sampleSource(writable(11))     // 11
 * ```
 */
export const sampleSource = <T>(source: T | MotionValue<T> | Readable<T>): T => {
    if (isMotionValue(source)) return (source as MotionValue<T>).get()
    if (isSvelteReadable<T>(source)) return get(source)
    return source as T
}

/**
 * Whether a `MotionValue` has already been through
 * {@link augmentMotionValue} — its `current` is an accessor rather
 * than a plain data field. Lives HERE, next to the representation it
 * sniffs, so a change to how augmentation marks values updates the
 * detector in the same edit. Augmenting mutates in place and must only
 * happen once; pass-through code paths check this first.
 *
 * @param value The motion value to test.
 * @returns Whether the value is already augmented.
 */
export const isAugmentedMotionValue = <T>(
    value: MotionValue<T>
): value is MotionValue<T> & AugmentedMotionValue<T> =>
    typeof Object.getOwnPropertyDescriptor(value, 'current')?.get === 'function'

/**
 * Layer Svelte 5 affordances onto a motion-dom `MotionValue`:
 *
 * 1. A `$state`-tracked `.current` accessor. motion-dom writes to its own
 *    `current` field on every frame via an internal setter; we redirect that
 *    setter through `$state` so templates and `$derived` / `$effect` re-run
 *    automatically. Same-value writes are skipped (motion-dom can call the
 *    setter at rest, and `$state` would itself dedupe, but the explicit
 *    check avoids the extra accessor work).
 *
 * 2. A `.subscribe(run)` shim implementing the Svelte readable store
 *    contract: synchronous initial emit, then re-emit on every change.
 *    Forwarded to motion-dom's `.on('change', …)` event bus.
 *
 * 3. `.destroy()` is wrapped so a caller-supplied `dispose` runs once before
 *    motion-dom's own teardown (and only once, guarded against re-entrant
 *    or duplicate destroy calls).
 *
 * The returned reference is the same `MotionValue` passed in, only retyped —
 * so identity checks (`isMotionValue`, `===`) still work and motion-dom's
 * own machinery (animation, follow, composition) is untouched.
 *
 * **Call once per MotionValue.** This function mutates the value (rewrites
 * `current`, `subscribe`, `destroy`). Calling it twice would re-define the
 * accessors and the first call's `dispose` would be discarded.
 *
 * @template T The value type — typically `number` or `string`.
 * @param value The motion-dom `MotionValue` to augment.
 * @param dispose Optional cleanup that runs once when `.destroy()` is first called (before motion-dom's internal teardown). Defaults to a no-op.
 * @returns The same `MotionValue` typed as {@link AugmentedMotionValue}.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { motionValue } from 'motion-dom'
 *   import { augmentMotionValue } from './augmentMotionValue.svelte.js'
 *
 *   const mv = motionValue(0)
 *   const aug = augmentMotionValue(mv, () => console.log('disposed'))
 *
 *   $effect(() => () => aug.destroy())
 * </script>
 *
 * <div style="transform: translateX({aug.current}px)">{aug.current}</div>
 * ```
 */
export const augmentMotionValue = <T>(
    value: MotionValue<T>,
    dispose: VoidFunction = () => undefined
): AugmentedMotionValue<T> => {
    // motion-dom's `.get()` returns `NonNullable<V>`, which would otherwise
    // narrow `$state` to that and reject nullable-T setter writes. Cast to T
    // so the state slot matches the public augmented signature; motion-dom's
    // own contract guarantees it never sets a null/undefined frame value.
    let current = $state<T>(value.get() as T)
    Object.defineProperty(value, 'current', {
        get: () => current,
        set: (v: T) => {
            if (v !== current) current = v
        },
        enumerable: true,
        configurable: true
    })

    const originalDestroy = value.destroy.bind(value)
    let destroyed = false
    value.destroy = () => {
        if (destroyed) return
        destroyed = true
        dispose()
        originalDestroy()
    }

    const subscribe = (run: (v: T) => void) => {
        run(value.get())
        return value.on('change', run)
    }
    Object.defineProperty(value, 'subscribe', {
        value: subscribe,
        writable: false,
        enumerable: false,
        configurable: true
    })

    return value as unknown as AugmentedMotionValue<T>
}

/**
 * Bridges a Svelte `Readable<T>` into a motion-dom `MotionValue<T>` that
 * mirrors the readable's emissions, so motion-dom primitives (`mapValue`,
 * `transformValue`, `attachFollow`, `getVelocity`, etc.) that only accept
 * `MotionValue` can track readable-shaped sources.
 *
 * The bridge:
 * 1. Seeds via `get(source)` so the initial value is correct synchronously.
 * 2. Subscribes to the readable, skipping the *synchronous initial emit*
 *    (Svelte readables always fire one on subscribe, but the seed already
 *    has it — without the skip the bridge would double-write on attach).
 * 3. Optionally coerces each emit through `coerce` — useful for unit-string
 *    sources (e.g. `"100px"` → `100`).
 *
 * Returns the bridge value and a `dispose` that tears down the subscription
 * and destroys the bridge MV. Callers register `dispose` with their lifecycle
 * ($effect cleanup or the augmented `destroy`'s `dispose` slot).
 *
 * @template TIn The readable's emit type (often `number | string`).
 * @template TOut The bridge MotionValue's value type (often `number`).
 * @param source A Svelte readable store.
 * @param coerce Optional transform applied to each emit (and the initial seed). Identity by default.
 * @returns A `MotionValue<TOut>` mirroring the readable + a dispose function.
 *
 * @example
 * ```ts
 * import { writable } from 'svelte/store'
 *
 * // Identity bridge — readable<number> → motionValue<number>
 * const w = writable(0)
 * const { value: mv, dispose } = bridgeReadableToMotionValue(w)
 * w.set(50); mv.get() === 50
 *
 * // Coerce bridge — readable<string> → motionValue<number>
 * const w2 = writable('100px')
 * const bridge = bridgeReadableToMotionValue<string, number>(w2, parseFloat)
 * bridge.value.get() === 100
 *
 * // Always pair with dispose() in your $effect cleanup.
 * $effect(() => () => dispose())
 * ```
 */
export const bridgeReadableToMotionValue = <TIn, TOut = TIn>(
    source: Readable<TIn>,
    coerce: (v: TIn) => TOut = (v) => v as unknown as TOut
): { value: MotionValue<TOut>; dispose: VoidFunction } => {
    const bridge = motionValue<TOut>(coerce(get(source)))
    let seenInitial = false
    const unsub = source.subscribe((v) => {
        if (!seenInitial) {
            seenInitial = true
            return
        }
        bridge.set(coerce(v))
    })
    return {
        value: bridge,
        dispose: () => {
            unsub()
            bridge.destroy()
        }
    }
}
