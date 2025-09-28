import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'HTML Content',
        sourceUrl: 'https://examples.motion.dev/react/html-content'
    }
}
