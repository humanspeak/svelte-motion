import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'layoutDependency',
    description: 'Gate layout measurement so FLIP only recomputes when a dependency changes.'
})
