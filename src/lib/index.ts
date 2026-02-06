import AnimatePresence from '$lib/components/AnimatePresence.svelte'
import MotionConfig from '$lib/components/MotionConfig.svelte'
import type { MotionComponents } from '$lib/html/index'
import * as html from '$lib/html/index'

// Create the motion object with all components
export const motion: MotionComponents = Object.fromEntries(
    Object.entries(html).map(([key, component]) => [key.toLowerCase(), component])
) as MotionComponents

// Re-export core animation functions from motion
export { animate, delay, hover, inView, press, resize, scroll, stagger, transform } from 'motion'

// Re-export easing functions
export {
    anticipate,
    backIn,
    backInOut,
    backOut,
    circIn,
    circInOut,
    circOut,
    cubicBezier,
    easeIn,
    easeInOut,
    easeOut
} from 'motion'

// Re-export utility functions
export { clamp, distance, distance2D, interpolate, mix, pipe, progress, wrap } from 'motion'

// Re-export all Motion types so consumers can import types from this package
export type {
    DragAxis,
    DragConstraints,
    DragControls,
    DragInfo,
    DragTransition,
    MotionAnimate,
    MotionInitial,
    MotionOnDirectionLock,
    MotionOnDragTransitionEnd,
    MotionOnInViewEnd,
    MotionOnInViewStart,
    MotionTransition,
    MotionWhileDrag,
    MotionWhileFocus,
    MotionWhileHover,
    MotionWhileInView,
    MotionWhileTap,
    Variants
} from '$lib/types'
export { useAnimationFrame } from '$lib/utils/animationFrame'
export { createDragControls } from '$lib/utils/dragControls'
export { useSpring } from '$lib/utils/spring'
/**
 * @deprecated Use `styleString` instead for reactive styles with automatic unit handling.
 */
export { stringifyStyleObject } from '$lib/utils/styleObject'
export { styleString } from '$lib/utils/styleObject.svelte'
export { useTime } from '$lib/utils/time'
export { useTransform } from '$lib/utils/transform'
export { AnimatePresence, MotionConfig }
