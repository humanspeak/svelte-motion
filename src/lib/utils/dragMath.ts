/**
 * Linearly interpolates between `from` and `to` by `t` [0,1].
 * Preserves float precision.
 */
export const mixNumber = (from: number, to: number, t: number): number => from + (to - from) * t

export type ConstraintRange = { min?: number; max?: number }
export type ConstraintElastic = { min: number; max: number } | number | undefined

/**
 * Apply float-safe constraints with optional elastic mixing.
 * Mirrors Framer Motion behavior: clamp via Math.min/Math.max with no rounding.
 * If `elastic` provided, blends toward the bound using its side-specific factor.
 */
export function applyConstraints(
    point: number,
    range: ConstraintRange,
    elastic?: ConstraintElastic
): number {
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
