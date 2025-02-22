import * as html from './html/index.js'

// Create type for all HTML components
type MotionComponents = {
    [K in Lowercase<keyof typeof html>]: (typeof html)[Capitalize<K>]
}

// Create the motion object with all components
export const motion: MotionComponents = Object.fromEntries(
    Object.entries(html).map(([key, component]) => [key.toLowerCase(), component])
) as MotionComponents

// Export all types
export type { MotionAnimate, MotionInitial, MotionTransition, MotionWhileTap } from './types.js'
