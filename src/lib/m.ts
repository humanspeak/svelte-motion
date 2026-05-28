import type { MotionComponents } from '$lib/html/index'
import * as html from '$lib/html/index'

/**
 * Lazy motion component namespace used with `<LazyMotion>`.
 *
 * The namespace mirrors the default `motion` object API (`m.div`, `m.button`,
 * `m.svg`, etc.) while reading feature availability from the nearest
 * LazyMotion provider.
 */
export const m: MotionComponents = Object.fromEntries(
    Object.entries(html).map(([key, component]) => [key.toLowerCase(), component])
) as MotionComponents
