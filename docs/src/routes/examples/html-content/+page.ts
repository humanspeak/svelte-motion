import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'HTML Content',
        description: 'Animate HTML content with enter and exit transitions.',
        sourceUrl: 'https://examples.motion.dev/react/html-content'
    }
}
