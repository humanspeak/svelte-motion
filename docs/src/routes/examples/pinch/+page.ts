import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Pinch',
        description:
            'Pinch to zoom, rotate and move an element, with elastic limits and rotation snapping.'
    }
}
