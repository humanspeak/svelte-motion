import type { PageLoad } from './$types'

/**
 * Loads page metadata for the mobile drawer example.
 * @returns Page metadata with title and description.
 */
export const load: PageLoad = () => ({
    title: 'Mobile Drawer',
    description:
        'A theme-aware drag-to-close bottom sheet built with drag, a bound y MotionValue, and dragControls.'
})
