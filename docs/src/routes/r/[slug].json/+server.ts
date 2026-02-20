import { registryIndex, registryItems } from '$lib/generated/registry-data'
import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, platform }) => {
    const slug = params.slug

    // Registry index — serve without tracking
    if (slug === 'registry') {
        return json(registryIndex)
    }

    const item = registryItems[slug]
    if (!item) throw error(404, `Registry item "${slug}" not found`)

    // Increment KV counter (fire-and-forget via waitUntil)
    const kv = platform?.env?.REGISTRY_DOWNLOADS
    if (kv) {
        platform.ctx.waitUntil(
            (async () => {
                try {
                    const current = await kv.get(`downloads:${slug}`)
                    const count = (current ? parseInt(current, 10) : 0) + 1
                    await kv.put(`downloads:${slug}`, String(count))
                } catch (e) {
                    console.error('KV increment failed:', e)
                }
            })()
        )
    }

    return json(item, {
        headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
            'Access-Control-Allow-Origin': '*'
        }
    })
}
