import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Motion Path',
        sourceUrl: 'https://examples.motion.dev/react/motion-path'
    }
}
