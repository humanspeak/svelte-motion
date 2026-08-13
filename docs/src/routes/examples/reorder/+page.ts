import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Reorder',
        description:
            'Drag-to-reorder lists and wrapped grids with automatic axis detection, RTL support, layout animations, and edge auto-scroll.'
    }
}
