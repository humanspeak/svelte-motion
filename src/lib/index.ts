import AnimatePresence from '$lib/components/AnimatePresence.svelte'
import MotionConfig from '$lib/components/MotionConfig.svelte'
import type { MotionComponents } from '$lib/html/index'
import * as html from '$lib/html/index'

// Create the motion object with all components
export const motion: MotionComponents = Object.fromEntries(
    Object.entries(html).map(([key, component]) => [key.toLowerCase(), component])
) as MotionComponents

// Export all types
export { animate, hover } from 'motion'
// Re-export all Motion types so consumers can import types from this package
export type { MotionAnimate, MotionInitial, MotionTransition, MotionWhileTap } from '$lib/types'
export { useSpring } from '$lib/utils/spring'
export { useTime } from '$lib/utils/time'
export { useTransform } from '$lib/utils/transform'
export { AnimatePresence, MotionConfig }
