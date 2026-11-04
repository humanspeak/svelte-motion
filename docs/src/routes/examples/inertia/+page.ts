import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'inertia',
    description:
        'Fling a value with inertia: it coasts, bounces off a boundary, and can snap to a grid.'
})
