/**
 * Linearly interpolates between `from` and `to` by `t` [0,1].
 * Preserves float precision.
 */
export const mixNumber = (from: number, to: number, t: number): number => from + (to - from) * t

/** Range with optional min/max boundaries for constraining a point. */
export type ConstraintRange = { min?: number; max?: number }

/** Per-side elastic factors, a uniform factor, or `undefined` for no elasticity. */
export type ConstraintElastic = { min: number; max: number } | number | undefined

/**
 * Apply float-safe constraints with optional elastic mixing.
 * Mirrors Framer Motion behavior: clamp via Math.min/Math.max with no rounding.
 * If `elastic` provided, blends toward the bound using its side-specific factor.
 *
 * @param point The unconstrained value to clamp.
 * @param range Min/max boundaries. Either or both may be omitted.
 * @param elastic Optional per-side elastic factor(s) in [0,1]. When provided,
 *   the value is interpolated toward the boundary instead of hard-clamped.
 * @returns The constrained (and optionally elastically blended) value.
 *
 * @example
 * ```ts
 * // Hard clamp to [0, 100]
 * applyConstraints(120, { min: 0, max: 100 }) // 100
 *
 * // Elastic overshoot (50 % blend toward max)
 * applyConstraints(120, { min: 0, max: 100 }, 0.5) // 110
 * ```
 */
export const applyConstraints = (
    point: number,
    range: ConstraintRange,
    elastic?: ConstraintElastic
): number => {
    const hasMin = range.min !== undefined
    const hasMax = range.max !== undefined
    if (hasMin && point < (range.min as number)) {
        if (elastic) {
            const e = typeof elastic === 'number' ? { min: elastic, max: elastic } : elastic
            return mixNumber(range.min as number, point, Math.max(0, Math.min(1, e.min)))
        }
        return Math.max(point, range.min as number)
    } else if (hasMax && point > (range.max as number)) {
        if (elastic) {
            const e = typeof elastic === 'number' ? { min: elastic, max: elastic } : elastic
            return mixNumber(range.max as number, point, Math.max(0, Math.min(1, e.max)))
        }
        return Math.min(point, range.max as number)
    }
    return point
}

/**
 * Parse a CSS `matrix(a, b, c, d, tx, ty)` string into translate components.
 *
 * Used to read the rendered translate after Motion writes inline transforms
 * during drag-cancel hooks.
 *
 * @param transform The computed `transform` style — typically `'none'` or
 *   `'matrix(1, 0, 0, 1, 10, 20)'`. `matrix3d(...)` is not supported.
 * @returns The 2D translate components `{ tx, ty }`. Defaults to
 *   `{ tx: 0, ty: 0 }` for `'none'` or any non-matching input.
 * @example
 *   parseMatrixTranslate('matrix(1, 0, 0, 1, 10, 20)') // → { tx: 10, ty: 20 }
 *   parseMatrixTranslate('none')                       // → { tx: 0, ty: 0 }
 */
export const parseMatrixTranslate = (transform: string): { tx: number; ty: number } => {
    const m = transform.match(/matrix\(([^)]+)\)/)
    if (!m) return { tx: 0, ty: 0 }
    const parts = m[1].split(',').map((s) => Number.parseFloat(s.trim()))
    return { tx: parts[4] ?? 0, ty: parts[5] ?? 0 }
}
