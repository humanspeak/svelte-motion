import { cancelFrame, frame, type FrameData } from 'motion-dom'

/**
 * Callback for {@link useAnimationFrame}.
 *
 * @param time Milliseconds since the loop's first frame.
 * @param delta Milliseconds elapsed since the previous frame.
 */
export type FrameCallback = (time: number, delta: number) => void

/**
 * Runs a callback once per frame on Motion's frameloop.
 *
 * Mirrors framer-motion's `useAnimationFrame` (`utils/use-animation-frame.ts`
 * @ v14.6.0). The callback receives `(time, delta)`: `time` is the number of
 * milliseconds since the loop's first frame (not the page's
 * `performance.now()`), and `delta` is the milliseconds elapsed since the
 * previous frame.
 *
 * - The callback runs in Motion's `update` step, batched with Motion's own
 *   per-frame work, so it is also driven by `processFrame()` and
 *   `MotionGlobalConfig.useManualTiming`.
 * - Call it inside `$effect` and return its cleanup to stop the loop when the
 *   effect is torn down.
 * - SSR-safe: does nothing when `window` is unavailable.
 *
 * @param callback Function to run each frame with `(time, delta)` in milliseconds.
 * @returns A cleanup function that stops the loop.
 * @see https://motion.dev/docs/react-use-animation-frame
 *
 * @example
 * ```svelte
 * <script>
 *   import { useAnimationFrame } from '@humanspeak/svelte-motion'
 *
 *   let ref
 *
 *   $effect(() => {
 *     return useAnimationFrame((time, delta) => {
 *       if (!ref) return
 *       const rotate = Math.sin(time / 10000) * 200
 *       const y = (1 + Math.sin(time / 1000)) * -50
 *       ref.style.transform = `translateY(${y}px) rotateX(${rotate}deg) rotateY(${rotate}deg)`
 *     })
 *   })
 * </script>
 *
 * <div bind:this={ref}>Animated content</div>
 * ```
 */
export const useAnimationFrame = (callback: FrameCallback): (() => void) => {
    // SSR guard
    if (typeof window === 'undefined') return () => {}

    let start = 0
    const provideTimeSinceStart = ({ timestamp, delta }: FrameData) => {
        if (!start) start = timestamp
        callback(timestamp - start, delta)
    }

    frame.update(provideTimeSinceStart, true)
    return () => cancelFrame(provideTimeSinceStart)
}
