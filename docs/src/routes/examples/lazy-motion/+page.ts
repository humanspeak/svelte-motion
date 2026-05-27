import type { PageLoad } from './$types'

/**
 * Provides metadata for the LazyMotion examples page.
 *
 * @returns Page title and description metadata.
 */
export const load: PageLoad = async () => {
    return {
        title: 'LazyMotion',
        description: 'Load Svelte Motion feature bundles with LazyMotion and the m namespace.'
    }
}
