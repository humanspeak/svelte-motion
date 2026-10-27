import type { MotionComponents } from '$lib/html/index'
import * as html from '$lib/html/index'
import { MOTION_KIND_PROP, withMotionKind } from '$lib/utils/motionKind'

/**
 * Lazy motion component namespace used with `<LazyMotion>`.
 *
 * The namespace mirrors the `motion` object API (`m.div`, `m.button`,
 * `m.svg`, etc.), but its components get their features only from the
 * nearest `<LazyMotion>` (upstream `render/components/m/create.ts`), while
 * `motion` components always have every feature and ignore it. Outside any
 * `<LazyMotion>` an `m` component currently keeps every feature.
 *
 * @example
 * ```svelte
 * <LazyMotion features={domAnimation}>
 *     <m.div whileHover={{ scale: 1.1 }} />
 * </LazyMotion>
 * ```
 */
export const m: MotionComponents = Object.fromEntries(
    Object.entries(html).map(([key, component]) => [
        key.toLowerCase(),
        /* @__PURE__ */ withMotionKind(component, { [MOTION_KIND_PROP]: 'm' })
    ])
) as MotionComponents
