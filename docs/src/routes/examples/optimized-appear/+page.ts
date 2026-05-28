import type { PageLoad } from './$types'

/**
 * Provides metadata for the optimized appear examples page.
 *
 * @returns Page title and description metadata.
 */
export const load: PageLoad = async () => {
    return {
        title: 'Optimized appear',
        description: 'Start SSR appear animations before Svelte hydrates the motion runtime.'
    }
}
