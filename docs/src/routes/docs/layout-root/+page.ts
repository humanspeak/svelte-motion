import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'layoutRoot & layoutAnchor',
    description:
        'Animate shared layoutId elements relative to a layout root, and choose the anchor point of relative layout projection.'
})
