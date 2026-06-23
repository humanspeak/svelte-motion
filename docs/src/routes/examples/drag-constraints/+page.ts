import type { PageLoad } from './$types'

/**
 * Loads page metadata for the drag constraints example.
 * @returns Page metadata with title and description.
 */
export const load: PageLoad = () => ({
    title: 'Drag Constraints',
    description:
        'A polished constrained-drag stage showing elastic overdrag, ref bounds, and spring settling.'
})
