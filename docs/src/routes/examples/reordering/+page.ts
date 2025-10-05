import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Reordering',
        sourceUrl: 'https://examples.motion.dev/react/reordering'
    }
}
