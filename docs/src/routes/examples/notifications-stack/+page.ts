import type { PageLoad } from './$types'

export const load: PageLoad = () => {
    return {
        title: 'Notifications Stack',
        description: 'iOS-style notification stack with variant-based animations',
        sourceUrl:
            'https://github.com/humanspeak/svelte-motion/tree/main/docs/src/routes/examples/notifications-stack'
    }
}
