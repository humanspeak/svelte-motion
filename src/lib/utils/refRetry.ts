/**
 * Schedule `callback` to retry resolving a `bind:this` ref, without using
 * motion-dom's shared `microtask` batcher.
 *
 * Re-scheduling a `microtask` job from inside a running `microtask` batch
 * leaves the batcher's `runNextFrame` flag set with no batch queued, so it
 * never runs again (motion-dom `frameloop/batcher.ts` processBatch / wake /
 * schedule @ v14.6.0; upstream `useScroll` has the same pattern). The first
 * attempt uses `queueMicrotask`, so a ref that hydrates in the same tick
 * attaches before the next frame; later attempts wait an animation frame, so a
 * ref that never resolves can't spin the microtask queue.
 *
 * @param callback - Called once, on the next attempt.
 * @param attempt - 0 for the first retry, then increasing.
 * @returns A cancel function. Calling it after the callback ran is a no-op.
 * @example
 * ```ts
 * const cancel = scheduleRefRetry(tryAttach, attempts++)
 * ```
 */
export const scheduleRefRetry = (callback: () => void, attempt: number): (() => void) => {
    let cancelled = false

    if (attempt === 0) {
        queueMicrotask(() => {
            if (!cancelled) callback()
        })
        return () => {
            cancelled = true
        }
    }

    const run = () => {
        if (!cancelled) callback()
    }

    if (typeof requestAnimationFrame === 'function') {
        const id = requestAnimationFrame(run)
        return () => {
            cancelled = true
            if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id)
        }
    }

    const id = setTimeout(run, 16)
    return () => {
        cancelled = true
        clearTimeout(id)
    }
}
