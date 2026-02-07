import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Motion Path',
        description: 'Animate elements along an SVG path with offset distance.',
        sourceUrl: 'https://examples.motion.dev/react/motion-path'
    }
}
