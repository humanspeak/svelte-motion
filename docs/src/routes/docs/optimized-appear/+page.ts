import type { PageLoad } from './$types'

/**
 * Provides metadata for the optimized appear docs page.
 *
 * @returns Page title and description metadata.
 */
export const load: PageLoad = () => ({
    title: 'Optimized appear',
    description: 'Start SSR appear animations before hydration to avoid first-paint flashes.'
})
