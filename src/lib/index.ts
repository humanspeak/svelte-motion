import MotionConfig from './components/MotionConfig.svelte'
import type { MotionComponents } from './html/index.js'
import * as html from './html/index.js'

// Create the motion object with all components
export const motion: MotionComponents = Object.fromEntries(
    Object.entries(html).map(([key, component]) => [key.toLowerCase(), component])
) as MotionComponents

// Export all types
export type { MotionAnimate, MotionInitial, MotionTransition, MotionWhileTap } from './types.js'
export { MotionConfig }
