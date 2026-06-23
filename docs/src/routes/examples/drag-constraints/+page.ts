import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'Drag Constraints',
    description:
        'A polished constrained-drag stage showing elastic overdrag, ref bounds, and spring settling.'
})
