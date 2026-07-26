/**
 * What remains of the hover module.
 *
 * `attachWhileHover` (~460 lines: per-channel MotionValues, a composed
 * transform writer, coordinator setActive/protected-key emulation) went with
 * plan 003 of the visual-element-core batch — hover is `attachHoverGesture` in
 * `gestures.ts` now, which only flips `setActive('whileHover', …)`.
 *
 * The baseline helpers (`computeHoverBaseline`, `splitHoverDefinition`) and the
 * unused readers (`isHoverCapable`, `readTransformScale`, `parseUnitValue`) went
 * with drag-single-writer 004: their last callers were `whileDrag` (now
 * `setActive('whileDrag')`) and `whilePan` (now `animateTarget` restoring from
 * the node's own base target), so nothing hand-computes a restore baseline any
 * more.
 *
 * `readTransformChannels` survives because it answers a different question — the
 * element's VISUAL transform channels, used by the container's relative-keyframe
 * live reader (`readLiveChannelValue`, for `'+=N'` resolution).
 */

/**
 * Read the element's current 2D transform channels from its computed matrix —
 * the VISUAL values, regardless of which system last wrote them.
 *
 * Decomposes `matrix(a, b, c, d, e, f)`: translation is `(e, f)`, uniform scale
 * is `hypot(a, b)`, and rotation is `atan2(b, a)` in degrees (the same sign
 * convention the browser reports and that motion writes). Returns identity
 * values for `none`/unparseable input, and `null` for a `matrix3d(...)`
 * transform — 3D decomposition is out of scope (see plan 002), so callers seed
 * only the channels this 2D reader can trust and leave 3D channels alone.
 *
 * @param el Target element.
 * @returns `{ scale, x, y, rotate }` visual channel values (identity when
 *   untransformed), or `null` when the transform is a 3D matrix.
 * @example
 * ```ts
 * const visual = readTransformChannels(el) // seed each channel continuously
 * ```
 */
export const readTransformChannels = (
    el: HTMLElement
): { scale: number; x: number; y: number; rotate: number } | null => {
    const identity = { scale: 1, x: 0, y: 0, rotate: 0 }
    const transform = getComputedStyle(el).transform
    if (!transform || transform === 'none') return identity
    // A 3D transform serializes to matrix3d(...); this 2D reader cannot safely
    // decompose it, so signal null and let the caller skip those channels.
    if (transform.includes('matrix3d')) return null
    const matrix = transform.match(/matrix\(([^)]+)\)/)
    if (!matrix) return identity

    const [a, b, , , e, f] = matrix[1].split(',').map((part) => Number.parseFloat(part.trim()))
    if (!Number.isFinite(a) || !Number.isFinite(b)) return identity
    return {
        scale: Math.hypot(a, b),
        x: Number.isFinite(e) ? e : 0,
        y: Number.isFinite(f) ? f : 0,
        rotate: (Math.atan2(b, a) * 180) / Math.PI
    }
}
