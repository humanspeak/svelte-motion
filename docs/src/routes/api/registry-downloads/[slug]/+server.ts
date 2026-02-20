import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, platform }) => {
    if (!params.slug) throw error(400, 'Missing slug')

    const kv = platform?.env?.REGISTRY_DOWNLOADS
    if (!kv) return json({ slug: params.slug, downloads: null })

    const value = await kv.get(`downloads:${params.slug}`)
    return json(
        { slug: params.slug, downloads: value ? parseInt(value, 10) : 0 },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    )
}
