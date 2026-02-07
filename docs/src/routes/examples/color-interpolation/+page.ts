import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Color Interpolation',
        description: 'Smooth color transitions between multiple color values.',
        sourceUrl: 'https://motion.dev/docs/motion-animate#color-interpolation'
    }
}
