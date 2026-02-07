import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'useTime (Synced)',
        description: 'Synchronized time-based animations across multiple elements.',
        sourceUrl: 'https://motion.dev/docs/react-use-time'
    }
}
