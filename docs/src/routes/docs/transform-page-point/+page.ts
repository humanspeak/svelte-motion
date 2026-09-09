import type { PageLoad } from './$types'

/** Loads metadata for the transformPagePoint guide. */
export const load: PageLoad = () => ({
    title: 'transformPagePoint',
    description:
        'Correct drag and pan coordinates when motion elements live inside scaled CSS containers.'
})
