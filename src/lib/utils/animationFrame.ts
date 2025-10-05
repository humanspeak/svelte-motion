/**
 * Runs a callback on every animation frame with the current timestamp.
 *
 * This is a Svelte-based animation loop utility that mirrors Framer Motion's
 * `useAnimationFrame` hook. The callback receives a DOMHighResTimeStamp
 * representing the time elapsed since the time origin.
 *
 * - The callback is invoked once per frame via `requestAnimationFrame`.
 * - The animation loop automatically starts when called in a `$effect` and stops on cleanup.
 * - SSR-safe: Does nothing when `window` is unavailable.
 *
 * @param {(time: number) => void} callback Function to run each frame, receives DOMHighResTimeStamp
 * @see https://motion.dev/docs/react-use-animation-frame
 *
 * @example
 * ```svelte
 * <script>
 *   import { useAnimationFrame } from 'svelte-motion'
 *
 *   let ref
 *
 *   $effect(() => {
 *     return useAnimationFrame((t) => {
 *       if (!ref) return
 *       const rotate = Math.sin(t / 10000) * 200
 *       const y = (1 + Math.sin(t / 1000)) * -50
 *       ref.style.transform = `translateY(${y}px) rotateX(${rotate}deg) rotateY(${rotate}deg)`
 *     })
 *   })
 * </script>
 *
 * <div bind:this={ref}>Animated content</div>
 * ```
 */
export function useAnimationFrame(callback: (time: DOMHighResTimeStamp) => void): () => void {
    // SSR guard
    if (typeof window === 'undefined') return () => {}

    let rafId: number | undefined
    let isActive = true

    const loop = (time: DOMHighResTimeStamp) => {
        callback(time)
        if (isActive) {
            rafId = requestAnimationFrame(loop)
        }
    }

    rafId = requestAnimationFrame(loop)

    return () => {
        isActive = false
        if (rafId !== undefined) {
            cancelAnimationFrame(rafId)
        }
    }
}
