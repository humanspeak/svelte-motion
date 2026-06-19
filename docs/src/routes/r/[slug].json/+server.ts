import { registryIndex, registryItems } from '$lib/generated/registry-data'
import { getPostHogClient } from '$lib/server/posthog'
import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, platform, request }) => {
    const slug = params.slug

    // Registry index — serve without tracking
    if (slug === 'registry') {
        return json(registryIndex)
    }

    const item = registryItems[slug]
    if (!item) throw error(404, `Registry item "${slug}" not found`)

    const distinctId = request.headers.get('x-forwarded-for') || 'anonymous'

    // Track download in PostHog; wrap in waitUntil on Cloudflare so the flush
    // completes after the response is returned without blocking it.
    const phFlush = (async () => {
        const posthog = getPostHogClient()
        posthog.capture({
            distinctId,
            event: 'registry_component_downloaded',
            properties: {
                component: slug,
                ['user_agent']: request.headers.get('user-agent') ?? undefined
            }
        })
        await posthog.flush()
    })()
    platform?.ctx?.waitUntil(phFlush)

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
