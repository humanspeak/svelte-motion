import { cancelFrame, frame, motionValue, type FrameData, type MotionValue } from 'motion-dom'
import { SvelteMap } from 'svelte/reactivity'
import { augmentMotionValue, type AugmentedMotionValue } from './augmentMotionValue.svelte.js'

/**
 * One shared frame-driven time source for a given `id`. Multiple
 * `useTime(id)` callers all observe the same elapsed clock but each
 * receives their own `MotionValue`, so destroying one consumer's value
 * never affects the others. The frame-loop callback is cancelled when
 * the last consumer unmounts.
 */
type SharedTimeline = {
    base: MotionValue<number>
    refcount: number
    cancel: () => void
}

// `SvelteMap` (not plain Map) per `eslint/svelte/prefer-svelte-reactivity`
// inside `.svelte.ts` files. The contents aren't read in reactive scopes —
// this is a plain keyed cache — but the linter rule applies uniformly.
const sharedTimelines = new SvelteMap<string, SharedTimeline>()

// Clear shared timelines on HMR dispose to avoid stale entries across hot
// reloads.
if (
    import.meta &&
    (import.meta as unknown as { hot?: { dispose: (cb: () => void) => void } }).hot
) {
    ;(import.meta as unknown as { hot: { dispose: (cb: () => void) => void } }).hot.dispose(() => {
        for (const t of sharedTimelines.values()) {
            t.cancel()
            t.base.destroy()
        }
        sharedTimelines.clear()
    })
}

/**
 * Starts a keep-alive frame-loop callback that writes elapsed-milliseconds
 * into a fresh `MotionValue<number>`. Returns the value and a cancel
 * function that stops the loop. Caller owns the value's destroy lifecycle.
 *
 * Uses motion-dom's `frame.update(cb, true)` — `true` is the `keepAlive`
 * flag, telling the frame loop to re-schedule the callback every frame
 * automatically. Matches React framer-motion's `useAnimationFrame`.
 */
const startTimeBase = (): { base: MotionValue<number>; cancel: () => void } => {
    const base = motionValue<number>(0)
    let start = 0
    const tick = ({ timestamp }: FrameData) => {
        if (!start) start = timestamp
        base.set(timestamp - start)
    }
    frame.update(tick, true)
    return {
        base,
        cancel: () => cancelFrame(tick)
    }
}

/**
 * Returns an augmented `MotionValue<number>` that ticks once per render
 * frame with the milliseconds elapsed since the value was created.
 *
 * Mirrors React framer-motion's `useTime` 1:1: a `MotionValue<number>`
 * driven by motion-dom's `frame.update(tick, true)` keep-alive callback.
 * The frame loop dedupes per-frame work across all motion-dom consumers,
 * so multiple `useTime()` calls share the same render schedule.
 *
 * Two modes:
 *
 * - **Unique timeline** — `useTime()` starts its own keep-alive callback.
 *   The motion value and the callback are torn down when the surrounding
 *   `$effect` scope unmounts.
 * - **Shared timeline** — `useTime(id)` callers passing the same `id` all
 *   observe a single shared frame-loop callback. Each call still returns
 *   an independent motion value (so destroying one consumer's value
 *   doesn't ripple to others) but the values stay in lockstep. The
 *   shared callback cancels the moment the last consumer unmounts; the
 *   next `useTime(id)` call restarts it.
 *
 * The result is augmented with a `$state`-backed `.current` getter and a
 * `.subscribe` shim — it composes with `useTransform`, `useSpring`, and
 * the rest of the Tier 2 surface.
 *
 * Lifecycle: must be called during component initialization. SSR-safe:
 * returns a static `motionValue(0)` with no frame loop on the server.
 *
 * @param id Optional timeline identifier for sharing across components.
 * @returns A `MotionValue<number>` with `.current` and `.subscribe`.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useTime, useTransform } from '@humanspeak/svelte-motion'
 *
 *   const time = useTime()
 *   const rotate = useTransform(time, [0, 4000], [0, 360], { clamp: false })
 * </script>
 *
 * <div style="transform: rotate({rotate.current}deg)">↻</div>
 * ```
 *
 * @see https://motion.dev/docs/react-use-time
 */
export const useTime = (id?: string): AugmentedMotionValue<number> => {
    // SSR: return a static motion value with no frame loop. Matches
    // useSpring / useScroll's SSR branch — no $effect is registered.
    if (typeof window === 'undefined') {
        return augmentMotionValue(motionValue<number>(0))
    }

    // Unique timeline: own callback, own MV, own lifecycle.
    if (!id) {
        const { base, cancel } = startTimeBase()
        $effect(() => () => {
            cancel()
            base.destroy()
        })
        return augmentMotionValue(base)
    }

    // Shared timeline: one frame callback per `id`, mirrored into per-
    // consumer MVs.
    let timeline = sharedTimelines.get(id)
    if (!timeline) {
        const { base, cancel } = startTimeBase()
        timeline = { base, refcount: 0, cancel }
        sharedTimelines.set(id, timeline)
    }
    timeline.refcount++

    const consumerMv = motionValue<number>(timeline.base.get())
    const unsubBase = timeline.base.on('change', (t) => consumerMv.set(t))

    $effect(() => () => {
        unsubBase()
        consumerMv.destroy()
        const t = sharedTimelines.get(id)
        if (!t) return
        t.refcount--
        if (t.refcount > 0) return
        t.cancel()
        t.base.destroy()
        sharedTimelines.delete(id)
    })

    return augmentMotionValue(consumerMv)
}
