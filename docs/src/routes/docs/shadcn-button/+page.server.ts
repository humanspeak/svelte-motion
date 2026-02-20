import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ platform }) => {
    let downloads: number | null = null
    const kv = platform?.env?.REGISTRY_DOWNLOADS
    if (kv) {
        try {
            const value = await kv.get('downloads:animated-button')
            downloads = value ? parseInt(value, 10) : 0
        } catch {
            /* silently fail */
        }
    }

    return {
        title: 'Animated Button (shadcn)',
        description: 'Drop-in animated replacement for the shadcn Button component.',
        downloads
    }
}
