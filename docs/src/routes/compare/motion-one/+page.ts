import { getCompetitor } from '$lib/compare-data'
import type { PageLoad } from './$types'

export const load: PageLoad = () => {
    const c = getCompetitor('motion-one')!
    return {
        title: `vs ${c.name}`,
        description: c.description
    }
}
