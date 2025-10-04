import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'useTime (Synced)',
        sourceUrl: 'https://motion.dev/docs/react-use-time'
    }
}
