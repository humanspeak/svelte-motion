/** One sampled animation frame. */
export type RecordedFrame = {
    /** Milliseconds since the recording started. */
    t: number
    /** Target's `getBoundingClientRect().top`, or `null` if not in the DOM. */
    top: number | null
    /** Whether the trigger element was in the DOM on this frame. */
    trigger: boolean
}

/** First frame that looks like a pop, with a plain-language reason. */
export type Pop = { frame: number; t: number; reason: string }

/**
 * Finds the first "pop" in a recorded top trace.
 *
 * A pop is either a single-frame upward move larger than `jumpPx`, or a
 * frame where the target is already at (or above) `settleTop` before
 * `earliestSettleMs`, i.e. before the glide could legitimately get there.
 *
 * @param frames Per-frame samples, in order.
 * @param options.jumpPx Largest allowed single-frame upward move (px).
 * @param options.settleTop Where the target should end up, or `null` to
 *     skip the "too early" rule.
 * @param options.earliestSettleMs Earliest time the target may reach
 *     `settleTop`.
 * @returns The first pop found, or `null` when the trace is smooth.
 */
export function findPop(
    frames: RecordedFrame[],
    options: { jumpPx: number; settleTop: number | null; earliestSettleMs: number }
): Pop | null {
    let previous: number | null = null
    for (const [index, frame] of frames.entries()) {
        const { top, t } = frame
        if (top === null) {
            previous = null
            continue
        }
        if (previous !== null && previous - top > options.jumpPx) {
            return {
                frame: index,
                t,
                reason: `jumped ${(previous - top).toFixed(1)} px up in one frame (${previous.toFixed(1)} → ${top.toFixed(1)})`
            }
        }
        if (
            options.settleTop !== null &&
            t < options.earliestSettleMs &&
            top <= options.settleTop + 0.5
        ) {
            return {
                frame: index,
                t,
                reason: `already at ${top.toFixed(1)} (settle position ${options.settleTop.toFixed(1)}) — the glide can’t get there before ~${options.earliestSettleMs} ms`
            }
        }
        previous = top
    }
    return null
}

/**
 * Compact per-frame trace: runs of frames with the same top (to 0.1 px)
 * and the same trigger presence are collapsed into one line.
 *
 * @param frames Per-frame samples, in order.
 * @param triggerLabel Short name for the trigger column (e.g. `a`).
 * @returns One line per run: `#first–#last +ms top [trigger]`.
 */
export function formatTrace(frames: RecordedFrame[], triggerLabel: string): string {
    const lines: string[] = []
    let start = 0
    const key = (frame: RecordedFrame) =>
        `${frame.top === null ? 'gone' : frame.top.toFixed(1)}|${frame.trigger}`
    for (let index = 1; index <= frames.length; index++) {
        if (index < frames.length && key(frames[index]) === key(frames[start])) continue
        const first = frames[start]
        const last = frames[index - 1]
        const range = start === index - 1 ? `#${start}` : `#${start}–#${index - 1}`
        const time =
            start === index - 1
                ? `+${Math.round(first.t)}ms`
                : `+${Math.round(first.t)}…${Math.round(last.t)}ms`
        const top = first.top === null ? 'gone' : first.top.toFixed(1)
        lines.push(
            `${range.padEnd(10)} ${time.padEnd(15)} top ${top.padStart(6)}${first.trigger ? `  ${triggerLabel}` : ''}`
        )
        start = index
    }
    return lines.join('\n')
}
