import type { PageLoad } from './$types'

/**
 * Loads metadata for the AnimatePresence custom example page.
 *
 * @returns Page metadata with the title and description used by the examples
 *     route.
 */
export const load: PageLoad = () => ({
    title: 'AnimatePresence custom',
    description:
        'Directional exit animations powered by AnimatePresence custom data and dynamic variants.'
})
