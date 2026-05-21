import {
    attachFollow,
    isMotionValue,
    motionValue,
    type FollowValueOptions,
    type MotionValue,
    type SpringOptions
} from 'motion-dom'
import { get, type Readable } from 'svelte/store'

/**
 * Spring + follow options for {@link useSpring}.
 *
 * Mirrors framer-motion's `useSpring` options 1:1: every `SpringOptions` key
 * (`stiffness`, `damping`, `mass`, `duration`, `visualDuration`, `bounce`,
 * `velocity`, `restDelta`, `restSpeed`) plus `skipInitialAnimation` for
 * scroll-restoration scenarios.
 *
 * @see https://motion.dev/docs/react-use-spring
 */
export type UseSpringOptions = SpringOptions & Pick<FollowValueOptions, 'skipInitialAnimation'>

/**
 * The augmented `MotionValue` returned by {@link useSpring}.
 *
 * It IS a real `MotionValue<T>` (so it passes `isMotionValue`, composes with
 * `animate()`, `useTransform`, and the rest of motion-dom). On top of that it
 * adds two affordances:
 *
 * - `current` — a Svelte-5 reactive read backed by `$state`. Use in templates
 *   and `$derived` / `$effect` to track the spring value without subscribing.
 * - `subscribe` — Svelte readable store contract. Calls the run function once
 *   synchronously with the current value, then on every change. Lets the
 *   spring be used with `$spring` template syntax, `get(spring)`, and as a
 *   dependency in `useTransform`'s function form.
 */
export type SpringMotionValue<T extends number | string> = Omit<MotionValue<T>, 'current'> & {
    /** Reactive read in Svelte 5 templates / `$derived` / `$effect`. */
    readonly current: T
    /** Svelte readable store compatibility. */
    subscribe: (run: (value: T) => void) => () => void
}

/**
 * Detects a Svelte readable store. Excludes motion-dom `MotionValue` instances
 * (which also expose `subscribe`-shaped APIs in some versions) so the
 * MotionValue path is preferred.
 */
const isSvelteReadable = (value: unknown): value is Readable<number | string> => {
    return (
        !!value &&
        typeof value === 'object' &&
        typeof (value as { subscribe?: unknown }).subscribe === 'function' &&
        !isMotionValue(value)
    )
}

/**
 * Creates a spring-animated `MotionValue`.
 *
 * Set a target with `.set(v)` to animate to it using spring physics, or
 * `.jump(v)` to skip the animation. Pass another `MotionValue` (or, for
 * backwards compatibility, a Svelte readable store like the ones from
 * `useScroll` / `useTime`) as `source` and the spring will animate towards
 * whatever that source emits.
 *
 * Returned object is a real motion-dom `MotionValue` — composes with
 * `animate()`, `useTransform`, `useVelocity`, and motion-dom's animation
 * engine. On top, it exposes:
 *
 * - `.current` — Svelte-5 reactive read for templates and `$derived` /
 *   `$effect`.
 * - `.subscribe(run)` — Svelte readable store contract so `$spring` template
 *   syntax and `useTransform(() => …, [spring])` keep working during the
 *   Tier 2 migration window.
 *
 * Lifecycle: must be called during component initialization. Cleanup is
 * registered via `$effect`; the spring stops animating and unsubscribes from
 * its source when the surrounding component / effect tears down. Call
 * `.destroy()` to clean up early.
 *
 * SSR-safe: returns a static `MotionValue` with no animation on the server.
 *
 * @template T
 * @param {number|string|MotionValue<number>|MotionValue<string>|Readable<number|string>} source Initial value or a source to follow.
 * @param {UseSpringOptions} [options] Spring + follow configuration.
 * @returns {SpringMotionValue<T>} A `MotionValue` with `.current` and `.subscribe`.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useSpring } from '@humanspeak/svelte-motion'
 *
 *   const x = useSpring(0, { stiffness: 300, damping: 30 })
 * </script>
 *
 * <button onclick={() => x.set(100)}>Animate</button>
 * <div>{x.current}</div>
 * ```
 *
 * @see https://motion.dev/docs/react-use-spring
 */
export function useSpring(source: number, options?: UseSpringOptions): SpringMotionValue<number>
export function useSpring(source: string, options?: UseSpringOptions): SpringMotionValue<string>
export function useSpring(
    source: MotionValue<number>,
    options?: UseSpringOptions
): SpringMotionValue<number>
export function useSpring(
    source: MotionValue<string>,
    options?: UseSpringOptions
): SpringMotionValue<string>
export function useSpring(
    source: Readable<number | string>,
    options?: UseSpringOptions
): SpringMotionValue<number> | SpringMotionValue<string>
export function useSpring(
    source: number | string | MotionValue<number> | MotionValue<string> | Readable<number | string>,
    options: UseSpringOptions = {}
): SpringMotionValue<number> | SpringMotionValue<string> {
    type T = number | string

    // SSR: return a static MotionValue with no animation. Reads return the
    // best-effort initial value; .set / .jump become no-ops to avoid drifting
    // away from the server-rendered snapshot.
    if (typeof window === 'undefined') {
        const initial = readInitial(source)
        const ssrValue = motionValue<T>(initial)
        ssrValue.set = () => undefined
        ssrValue.jump = () => undefined
        return augmentForSvelte(ssrValue, initial, () => undefined) as unknown as
            | SpringMotionValue<number>
            | SpringMotionValue<string>
    }

    // Resolve initial + follow source.
    let followSource: T | MotionValue<T>
    let cleanupReadableBridge: VoidFunction | undefined
    let svelteBridge: MotionValue<T> | undefined

    if (isMotionValue(source)) {
        followSource = source as MotionValue<T>
    } else if (isSvelteReadable(source)) {
        // Bridge a Svelte readable into a MotionValue so attachFollow can
        // track it. Synchronous initial sample comes from svelte/store's get().
        const initialFromReadable = get(source) as T
        svelteBridge = motionValue<T>(initialFromReadable)
        cleanupReadableBridge = source.subscribe((v) => {
            // The Svelte readable contract calls the subscriber synchronously
            // with the current value on subscribe. Skip if it equals the
            // already-seeded bridge value so attachFollow doesn't fire a
            // spring on the initial emit. Subsequent emits go through set()
            // and trigger animation.
            if (svelteBridge!.get() === v) return
            svelteBridge!.set(v as T)
        })
        followSource = svelteBridge
    } else {
        followSource = source as T
    }

    const initial: T = isMotionValue(followSource) ? (followSource.get() as T) : (followSource as T)

    const value = motionValue<T>(initial)
    const stopFollow = attachFollow(value, followSource, { type: 'spring', ...options })

    // Side-cleanup for our augmentations: stop the follow, unsubscribe from
    // the upstream Svelte readable, destroy the bridge MV. The public MV's
    // own destroy is routed through `augmentForSvelte`'s override below, so
    // either entry path (manual `.destroy()` or `$effect` teardown calling
    // `value.destroy()`) hits the same teardown sequence exactly once.
    let disposed = false
    const dispose = () => {
        if (disposed) return
        disposed = true
        stopFollow?.()
        cleanupReadableBridge?.()
        svelteBridge?.destroy()
    }

    // Bind cleanup to the surrounding reactive scope (component lifecycle in
    // practice). `$effect` must be in a reactive context — useSpring is
    // meant to be called from a `<script>` block, where this is guaranteed.
    $effect(() => {
        return () => value.destroy()
    })

    return augmentForSvelte(value, initial, dispose) as unknown as
        | SpringMotionValue<number>
        | SpringMotionValue<string>
}

/**
 * Pull the synchronous initial value out of any accepted source form.
 */
const readInitial = (source: unknown): number | string => {
    if (typeof source === 'number' || typeof source === 'string') return source
    if (isMotionValue(source)) return source.get() as number | string
    if (isSvelteReadable(source)) return get(source) as number | string
    return 0
}

/**
 * Layer Svelte-friendly affordances onto a motion-dom MotionValue:
 *
 * - `.current` — `$state`-backed reactive read kept in sync via `on('change')`.
 * - `.subscribe(run)` — Svelte readable store contract.
 *
 * Mutates the MotionValue in place and returns it cast to `SpringMotionValue`.
 * Calling `dispose` from the lifecycle hook tears everything down including
 * the change listener.
 */
const augmentForSvelte = <T extends number | string>(
    value: MotionValue<T>,
    initial: T,
    dispose: VoidFunction
): SpringMotionValue<T> => {
    // Replace motion-dom's plain `current` data property with an
    // accessor backed by a Svelte 5 `$state` cell. The setter is critical:
    // motion-dom's internal `setCurrent` does `this.current = v`, which now
    // hits our setter and routes the write into `$state` so templates and
    // `$derived` / `$effect` re-run automatically. The getter returns the
    // tracked value so reads inside reactive scopes track it.
    let current = $state(initial)
    Object.defineProperty(value, 'current', {
        get: () => current,
        set: (v: T) => {
            current = v
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
        run(value.get() as T)
        return value.on('change', run)
    }
    Object.defineProperty(value, 'subscribe', {
        value: subscribe,
        writable: false,
        enumerable: false,
        configurable: true
    })

    return value as unknown as SpringMotionValue<T>
}
