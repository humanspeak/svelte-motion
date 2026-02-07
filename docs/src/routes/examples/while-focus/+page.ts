import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'While Focus',
        description: 'Animate elements when they receive keyboard focus.',
        sourceUrl: 'https://motion.dev/docs/react-motion-component#focus'
    }
}
