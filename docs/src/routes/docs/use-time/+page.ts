import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'useTime',
    description: 'A reactive store that ticks once per animation frame with elapsed milliseconds.'
})
