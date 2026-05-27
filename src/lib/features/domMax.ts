import { domAnimation } from './domAnimation'
import type { FeatureBundle } from './index'

/**
 * Full DOM feature bundle: animations, gestures, drag, and layout features.
 */
export const domMax: FeatureBundle = {
    ...domAnimation,
    drag: true,
    layout: true
}
