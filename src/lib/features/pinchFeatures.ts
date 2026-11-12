import { isPinchFeatureEnabled, PinchGestureFeature } from '$lib/utils/pinchFeature'
import type { FeatureBundle } from './index'

/**
 * The `pinch` prop. Not part of `motion` components or the `domMax`
 * bundle, so load it on its own or alongside them:
 *
 * ```svelte
 * <LazyMotion features={pinchFeatures}>
 * <LazyMotion features={{ ...domMax, ...pinchFeatures }}>
 * ```
 *
 * Port of `framer-motion/src/render/dom/features-pinch.ts` (v14.12.0). The
 * bundle carries the feature class itself, so apps that never import it never
 * bundle motion-dom's pinch gesture.
 *
 * @example
 * ```svelte
 * <LazyMotion features={{ ...domMax, ...pinchFeatures }}>
 *     <m.div drag pinch={{ scale: { min: 1, max: 4 }, rotate: { snap: 90 } }} />
 * </LazyMotion>
 * ```
 */
export const pinchFeatures: FeatureBundle = {
    pinch: {
        Feature: PinchGestureFeature as never,
        isEnabled: isPinchFeatureEnabled
    }
}
