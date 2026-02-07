import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Reordering',
        description: 'Drag-to-reorder list items with smooth layout animations.',
        sourceUrl: 'https://examples.motion.dev/react/reordering'
    }
}
