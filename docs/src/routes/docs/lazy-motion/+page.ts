import type { PageLoad } from './$types'

/**
 * Provides metadata for the LazyMotion docs page.
 *
 * @returns Page title and description metadata.
 */
export const load: PageLoad = () => ({
    title: 'LazyMotion',
    description: 'Load motion feature bundles with LazyMotion and the m namespace.'
})
