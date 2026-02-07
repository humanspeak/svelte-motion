import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'useTime',
        description: 'Time-based animations using the useTime reactive store.',
        sourceUrl: 'https://motion.dev/docs/react-use-time'
    }
}
