/**
 * Calls `read` once per rendered frame, with that frame's final layout.
 *
 * A sample taken in a task (a `MessageChannel` message posted from a
 * requestAnimationFrame callback, a timer) reads the DOM as it is when that
 * task runs, which can include changes another task made after the frame was
 * drawn. That shows up as a one-frame "jump" that never reached the screen.
 * ResizeObserver callbacks instead run inside the rendering step, after every
 * requestAnimationFrame callback (Motion's frameloop included) and after
 * layout, so they see exactly the layout about to be painted. A hidden ticker
 * whose width flips every frame makes the observer fire on every frame.
 *
 * @param read - Reads whatever the caller samples (e.g. bounding rects).
 * @returns A function that stops sampling and removes the ticker.
 *
 * @example
 * ```ts
 * const widths: number[] = []
 * const stop = onPaintedFrame(() => widths.push(box.getBoundingClientRect().width))
 * // ...trigger the change, wait...
 * stop()
 * ```
 */
export const onPaintedFrame = (read: () => void): (() => void) => {
    const ticker = document.createElement('div')
    ticker.style.cssText =
        'position: fixed; left: -10px; top: -10px; width: 1px; height: 1px; visibility: hidden; pointer-events: none'
    document.body.appendChild(ticker)

    // `observe()` also delivers once for the starting size, on the next
    // rendered frame, which is as valid a sample as the rest.
    const observer = new ResizeObserver(() => read())
    observer.observe(ticker)

    let wide = false
    let rafId = 0
    const tick = () => {
        wide = !wide
        ticker.style.width = wide ? '2px' : '1px'
        rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
        cancelAnimationFrame(rafId)
        observer.disconnect()
        ticker.remove()
    }
}
