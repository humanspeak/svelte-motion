import type { PageLoad } from './$types'

export const load: PageLoad = () => {
    return {
        title: 'Notifications Stack',
        description: 'iOS-style notification stack with variant-based animations',
        sourceUrl: 'https://motion.dev/examples/react-notifications-stack'
    }
}
