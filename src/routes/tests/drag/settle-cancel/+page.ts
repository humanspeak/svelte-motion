import type { PageLoad } from './$types'

/**
 * Loads slow-review mode from the settle-cancel test page URL.
 * @param event Page load event containing the request URL.
 * @returns Page data with `slow` enabled when slow review params are present.
 */
export const load: PageLoad = ({ url }) => ({
    slow: url.searchParams.has('slow') || url.searchParams.has('slowmode')
})
