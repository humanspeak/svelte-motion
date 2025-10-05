/**
 * Invoke a callback on every animation frame with the current high-resolution timestamp.
 *
 * The callback is called once per frame with a DOMHighResTimeStamp. Safe to call during SSR — no loop is started if `window` is unavailable.
 *
 * @param callback - Function invoked each frame with the current `DOMHighResTimeStamp`
 * @returns A cleanup function that stops the animation loop when called
 * @see https://motion.dev/docs/react-use-animation-frame
 */
export function useAnimationFrame(callback: (time: DOMHighResTimeStamp) => void): () => void {
    // SSR guard
    if (typeof window === 'undefined') return () => {}

    let rafId: number | undefined

    const loop = (time: DOMHighResTimeStamp) => {
        callback(time)
        rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    return () => {
        if (rafId !== undefined) {
            cancelAnimationFrame(rafId)
        }
    }
}