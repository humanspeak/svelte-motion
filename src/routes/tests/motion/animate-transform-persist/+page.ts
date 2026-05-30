import type { PageLoad } from './$types'

export const load: PageLoad = ({ url }) => ({
    slow: url.searchParams.has('slow')
})
