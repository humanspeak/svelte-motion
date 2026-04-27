import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'useCycle',
        description: 'Cycle through animation variants or any series of values.',
        sourceUrl: 'https://motion.dev/docs/react-use-cycle'
    }
}
