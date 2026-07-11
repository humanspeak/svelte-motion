import {
    buildTransform,
    transformProps,
    type AnyResolvedKeyframe,
    type TransformTemplate
} from 'motion-dom'

/** Transform-channel values accepted by Motion's HTML transform builder. */
export type GestureTransformValues = Record<string, AnyResolvedKeyframe>

const getLastValue = (values: readonly unknown[]): unknown => values.at(-1)

/**
 * Build a gesture-owned transform in Motion's canonical channel order.
 *
 * @param latestValues Current transform-channel values.
 * @param baseTransform An authored raw CSS transform that cannot be represented as channels.
 * @param transformTemplate Optional user transform template applied to the live values.
 * @returns The composed CSS transform string.
 * @example
 * buildGestureTransform({ x: '20px', rotate: 4 }, 'perspective(600px)')
 * // => 'translateX(20px) rotate(4deg) perspective(600px)'
 */
export const buildGestureTransform = (
    latestValues: GestureTransformValues,
    baseTransform = '',
    transformTemplate?: TransformTemplate
): string => {
    const generated = buildTransform(latestValues, {}, transformTemplate)
    return [generated === 'none' ? '' : generated, baseTransform].filter(Boolean).join(' ')
}

/**
 * Resolve the final transform-channel values from a Motion target record.
 *
 * @param source Motion target whose transform channels should be collected.
 * @returns Only recognized transform channels with scalar final values.
 * @example
 * collectGestureTransformValues({ rotate: [0, 8], scale: 1.1, opacity: 0.5 })
 * // => { rotate: 8, scale: 1.1 } — keyframe arrays resolve to their final value
 */
export const collectGestureTransformValues = (
    source: Record<string, unknown> | undefined
): GestureTransformValues => {
    const values: GestureTransformValues = {}
    if (!source) return values

    for (const [key, value] of Object.entries(source)) {
        if (!transformProps.has(key)) continue
        const finalValue = Array.isArray(value) ? getLastValue(value) : value
        if (typeof finalValue === 'string' || typeof finalValue === 'number') {
            values[key] = finalValue
        }
    }
    return values
}

/**
 * Partition a Motion target into transform and native style channels.
 *
 * @param source Motion target to partition.
 * @returns Separate transform and native style records.
 * @example
 * splitGestureTransformValues({ rotate: 4, cursor: 'grabbing' })
 * // => { transform: { rotate: 4 }, native: { cursor: 'grabbing' } }
 */
export const splitGestureTransformValues = (source: Record<string, unknown>) => {
    const transform: Record<string, unknown> = {}
    const native: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(source)) {
        if (transformProps.has(key)) transform[key] = value
        else native[key] = value
    }
    return { transform, native }
}
