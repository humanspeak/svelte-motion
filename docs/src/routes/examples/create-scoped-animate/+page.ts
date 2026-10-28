import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'createScopedAnimate',
    description: 'An animate function bound to one element: selectors only resolve inside it.'
})
