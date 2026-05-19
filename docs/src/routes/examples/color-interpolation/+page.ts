import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Color Interpolation',
        description: 'Smooth color transitions between multiple color values.'
    }
}
