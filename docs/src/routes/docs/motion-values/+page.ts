import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'Motion values',
    description:
        'An overview of motion values — reactive stores that drive animations outside the render cycle.'
})
