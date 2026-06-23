import type { PageLoad } from './$types'

/**
 * Loads page metadata for the Scoped Motion Classes example.
 * @returns Page metadata with title and description.
 */
export const load: PageLoad = () => ({
    title: 'Scoped Motion Classes',
    description:
        'Keep component-scoped CSS selectors alive when they are passed to motion components.'
})
