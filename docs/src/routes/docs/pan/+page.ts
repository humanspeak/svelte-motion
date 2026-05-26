import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'Pan',
    description:
        'Pan gesture primitive — pointer offset/velocity reporting without drag constraints. Build swipe-to-dismiss sheets, custom carousels, and gesture-driven UI.'
})
