import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Reorder',
        description: 'Drag-to-reorder lists with automatic layout animations and edge auto-scroll.'
    }
}
