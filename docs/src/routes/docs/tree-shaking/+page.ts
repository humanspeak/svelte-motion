import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'Tree Shaking',
    description: 'Reduce bundle size by importing only the motion components you use.'
})
