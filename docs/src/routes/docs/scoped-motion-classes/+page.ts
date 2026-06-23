import type { PageLoad } from './$types'

/**
 * Loads metadata for the Scoped Motion Classes documentation page.
 * @returns Page metadata with title and description.
 */
export const load: PageLoad = () => ({
    title: 'Scoped Motion Classes',
    description:
        'Use @humanspeak/svelte-scoped-props when component-scoped CSS classes are passed to motion components.'
})
