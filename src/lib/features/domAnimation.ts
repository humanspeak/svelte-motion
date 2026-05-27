import type { FeatureBundle } from './index'

/**
 * DOM animation feature bundle: animations plus hover, tap, focus, pan,
 * and in-view gestures.
 */
export const domAnimation: FeatureBundle = {
    animations: true,
    gestures: true
}
