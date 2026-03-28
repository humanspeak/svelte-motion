import type { MotionComponents } from '$lib/html/index'
import * as html from '$lib/html/index'

// Create the motion object with all components
export const motion: MotionComponents = Object.fromEntries(
    Object.entries(html).map(([key, component]) => [key.toLowerCase(), component])
) as MotionComponents
