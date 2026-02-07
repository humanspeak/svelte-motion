import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'useTransform',
    description:
        'Create a derived store that maps a numeric source across ranges or computes values from other stores.'
})
