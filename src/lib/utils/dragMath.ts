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
