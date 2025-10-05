import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Color Interpolation',
        sourceUrl: 'https://motion.dev/docs/motion-animate#color-interpolation'
    }
}
