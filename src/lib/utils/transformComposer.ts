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
 * Match a simple, top-level `perspective(<length>)` function in an authored
 * transform string. The value class is deliberately narrow — `[^()]*` forbids
 * nested parens — so a `perspective(var(--x))` (or any function-valued
 * perspective) is left untouched rather than sliced into a corrupt fragment.
 */
const LEADING_PERSPECTIVE = /\bperspective\([^()]*\)/g

/**
 * Build a gesture-owned transform in Motion's canonical channel order.
 *
 * CSS transforms are non-commutative, and upstream motion-dom emits
 * `transformPerspective` FIRST in its canonical slot order (see
 * `~/Github/motion/packages/motion-dom/src/render/utils/keys-transform.ts`
 * `transformPropOrder`, perspective/transformPerspective at index 0). The
 * channelized values in `latestValues` are already ordered canonically by
 * `buildTransform`; this function additionally hoists any simple
 * `perspective(<length>)` function found in the opaque `baseTransform` ahead
 * of those generated channels so an authored `perspective(600px)` projects
 * the same way it does under framer-motion.
 *
 * Only the perspective slot is reordered. Every other authored function in
 * `baseTransform` keeps its original relative position and is appended after
 * the generated channels — honoring the remaining canonical slots for an
 * arbitrary opaque string would require a full CSS transform parser, which is
 * out of scope by design.
 *
 * @param latestValues Current transform-channel values.
 * @param baseTransform An authored raw CSS transform that cannot be represented as channels.
 * @param transformTemplate Optional user transform template applied to the live values.
 * @returns The composed CSS transform string.
 * @example
 * buildGestureTransform({ scale: 1.2 }, 'perspective(600px) rotateX(20deg)')
 * // => 'perspective(600px) scale(1.2) rotateX(20deg)'
 */
export const buildGestureTransform = (
    latestValues: GestureTransformValues,
    baseTransform = '',
    transformTemplate?: TransformTemplate
): string => {
    const generated = buildTransform(latestValues, {}, transformTemplate)
    const generatedPart = generated === 'none' ? '' : generated

    const perspectiveParts: string[] = []
    const strippedBase = baseTransform.replace(LEADING_PERSPECTIVE, (match) => {
        perspectiveParts.push(match)
        return ''
    })
    // Preserve the pre-hoist string byte-for-byte when nothing was lifted, so
    // the non-perspective base path is unchanged; only collapse the whitespace
    // left behind by a removed perspective token.
    const baseRemainder =
        perspectiveParts.length > 0 ? strippedBase.replace(/\s+/g, ' ').trim() : baseTransform

    return [perspectiveParts.join(' '), generatedPart, baseRemainder].filter(Boolean).join(' ')
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
