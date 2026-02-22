import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ platform }) => {
    let downloads: number | null = null
    const kv = platform?.env?.REGISTRY_DOWNLOADS
    if (kv) {
        try {
            const value = await kv.get('downloads:animated-tabs')
            downloads = value ? parseInt(value, 10) : 0
        } catch (err) {
            console.error(
                '[shadcn-tabs/+page.server.ts] KV get "downloads:animated-tabs" failed:',
                err
            )
        }
    }

    return {
        title: 'Animated Tabs (shadcn)',
        description:
            'Drop-in animated replacement for shadcn Tabs with a spring-based sliding indicator.',
        downloads
    }
}
