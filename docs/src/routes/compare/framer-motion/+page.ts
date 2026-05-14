import { getCompetitor } from '$lib/compare-data'
import type { PageLoad } from './$types'

export const load: PageLoad = () => {
    const c = getCompetitor('framer-motion')!
    return {
        title: `vs ${c.name}`,
        description: c.description
    }
}
