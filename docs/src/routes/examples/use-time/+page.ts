import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'useTime',
        sourceUrl: 'https://motion.dev/docs/react-use-time'
    }
}
