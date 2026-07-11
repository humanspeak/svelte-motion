import type { PageLoad } from './$types'

/**
 * Loads page metadata for the drag transforms example.
 * @returns Page metadata with title and description.
 */
export const load: PageLoad = () => ({
    title: 'Drag Transforms',
    description:
        'Drag translation composed with authored rotate, skew, perspective, and whileDrag transform channels.'
})
