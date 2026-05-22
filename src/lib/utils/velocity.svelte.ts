import { motionValue } from 'motion-dom'
import { type Readable } from 'svelte/store'
import { augmentMotionValue, type AugmentedMotionValue } from './augmentMotionValue.svelte.js'

/**
 * Source for {@link useVelocity}: a motion-dom `MotionValue` (via
 * `useMotionValue`, `useSpring`, `useScroll`, etc.) or a Svelte readable.
 * Both expose `.subscribe(run)` with matching semantics, so the hook
 * consumes them interchangeably.
 */
export type VelocitySource = AugmentedMotionValue<number | string> | Readable<number | string>

/**
 * Parses a numeric value from a number or unit string (e.g. `"100px"` → `100`).
 */
const parseNumeric = (v: number | string): number => {
    if (typeof v === 'number') return v
    const parsed = Number.parseFloat(String(v))
    return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Creates an augmented `MotionValue<number>` whose value tracks the velocity
 * of `source` in units/second.
 *
 * Internally feeds source updates into a motion-dom `MotionValue` (which
 * tracks per-frame deltas and timestamps for free), and polls
 * `getVelocity()` on every animation frame until movement settles below
 * `0.001` units/second — at which point velocity snaps to `0` and the poll
 * loop stops. The next source emit restarts it.
 *
 * The returned value is a real motion-dom `MotionValue` augmented with a
 * `$state`-backed `.current` getter and a Svelte readable `.subscribe`
 * shim — it composes with `useTransform`, `useSpring`, etc. and reads
 * reactively in Svelte 5 scopes.
 *
 * Lifecycle: must be called during component initialization. The source
 * subscription, the velocity-tracking motion value, and the result are all
 * torn down when the surrounding `$effect` scope unmounts.
 *
 * SSR-safe: returns a static `motionValue(0)` with no source subscription
 * and no RAF loop on the server.
 *
 * @param source A motion value or readable store of numeric or unit-string values.
 * @returns A `MotionValue<number>` with `.current` and `.subscribe`.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useSpring, useTransform, useVelocity } from '@humanspeak/svelte-motion'
 *
 *   const x = useSpring(0)
 *   const xVelocity = useVelocity(x)
 *   const skew = useTransform(xVelocity, [-1000, 0, 1000], [-20, 0, 20])
 * </script>
 * ```
 *
 * @see https://motion.dev/docs/react-use-velocity
 */
export const useVelocity = (source: VelocitySource): AugmentedMotionValue<number> => {
    const result = motionValue<number>(0)

    // SSR: no source subscription, no RAF loop. Returns the static augmented
    // motion value so callers can compose it without branching.
    if (typeof window === 'undefined') {
        return augmentMotionValue(result)
    }

    // Internal motion-dom MV — tracks per-frame deltas and timestamps so
    // `getVelocity()` Just Works without reimplementing the math here.
    const tracker = motionValue<number>(0)

    let raf = 0
    let settled = true

    const poll = () => {
        const v = tracker.getVelocity()
        if (Math.abs(v) < 0.001) {
            // Movement stopped — snap to 0 and stop polling. The next source
            // emit restarts the loop.
            settled = true
            raf = 0
            result.set(0)
            return
        }
        result.set(v)
        raf = requestAnimationFrame(poll)
    }

    const startPolling = () => {
        if (!settled) return
        settled = false
        raf = requestAnimationFrame(poll)
    }

    const unsubSource = source.subscribe((v) => {
        tracker.set(parseNumeric(v))
        startPolling()
    })

    $effect(() => () => {
        unsubSource()
        if (raf) cancelAnimationFrame(raf)
        tracker.destroy()
        result.destroy()
    })

    return augmentMotionValue(result)
}
