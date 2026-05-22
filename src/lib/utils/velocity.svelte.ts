import { cancelFrame, frame, isMotionValue, motionValue, type MotionValue } from 'motion-dom'
import { type Readable } from 'svelte/store'
import {
    augmentMotionValue,
    bridgeReadableToMotionValue,
    type AugmentedMotionValue
} from './augmentMotionValue.svelte.js'

/**
 * Source for {@link useVelocity}: a motion-dom `MotionValue` or a Svelte
 * readable. Svelte readables are bridged into a `MotionValue` so motion-dom's
 * native velocity tracking can drive the result.
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
 * Mirrors React framer-motion 1:1: on every `source` change, schedules an
 * `updateVelocity` callback in motion-dom's frame loop via
 * `frame.update(updateVelocity, false, true)`. `updateVelocity` reads
 * `source.getVelocity()` (motion-dom tracks per-frame deltas + timestamps
 * for free) and writes it to the result. If velocity is still non-zero,
 * `updateVelocity` re-schedules itself for the next frame — so the loop
 * only runs while there's actual motion and snaps to `0` the moment things
 * settle. Idle CPU is zero.
 *
 * Returned value is a real motion-dom `MotionValue` (composes with
 * `useTransform`, `useSpring`, `useMotionTemplate`, etc.) plus a
 * `$state`-backed `.current` getter and a `.subscribe` shim.
 *
 * Lifecycle: must be called during component initialization. The change
 * subscription, the frame-loop callback, and any Svelte-readable bridge are
 * all torn down when the surrounding `$effect` unmounts.
 *
 * SSR-safe: returns a static augmented motion value with no subscriptions
 * and no frame loop on the server.
 *
 * @param source A motion value or readable store of numeric or unit-string values.
 * @returns A `MotionValue<number>` with `.current` and `.subscribe`.
 *
 * @see https://motion.dev/docs/react-use-velocity
 */
export const useVelocity = (source: VelocitySource): AugmentedMotionValue<number> => {
    // Bridge Svelte readables into a MotionValue so motion-dom's getVelocity()
    // tracks per-frame deltas natively. MotionValue sources pass through
    // unchanged — caller owns their destroy lifecycle.
    let tracker: MotionValue<number>
    let disposeBridge: VoidFunction | undefined

    if (isMotionValue(source)) {
        tracker = source as unknown as MotionValue<number>
    } else if (typeof window !== 'undefined') {
        const bridge = bridgeReadableToMotionValue<number | string, number>(source, parseNumeric)
        tracker = bridge.value
        disposeBridge = bridge.dispose
    } else {
        tracker = motionValue<number>(0)
    }

    const result = motionValue<number>(tracker.getVelocity())

    // SSR: skip the frame-loop wiring entirely and return a static MV.
    if (typeof window === 'undefined') {
        return augmentMotionValue(result)
    }

    const updateVelocity = () => {
        const latest = tracker.getVelocity()
        result.set(latest)
        if (latest) frame.update(updateVelocity)
    }

    const unsubChange = tracker.on('change', () => {
        // keepAlive: false, immediate: true — run at end of current frame if
        // we're already in one. Matches React framer-motion's useVelocity.
        frame.update(updateVelocity, false, true)
    })

    $effect(() => () => {
        unsubChange()
        cancelFrame(updateVelocity)
        disposeBridge?.()
        result.destroy()
    })

    return augmentMotionValue(result)
}
