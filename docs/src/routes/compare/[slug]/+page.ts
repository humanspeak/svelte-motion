import { competitors, getCompetitor } from '$lib/compare-data'
import { error } from '@sveltejs/kit'
import type { EntryGenerator, PageLoad } from './$types'

export const entries: EntryGenerator = () => competitors.map(({ slug }) => ({ slug }))

export const load: PageLoad = ({ params }) => {
    const competitor = getCompetitor(params.slug)
    if (!competitor) throw error(404, `Unknown comparison: ${params.slug}`)
    return {
        competitor,
        title: `vs ${competitor.name}`,
        description: competitor.description
    }
}
