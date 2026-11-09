import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Reorder.Board',
        description:
            'Drag cards between kanban columns with Reorder.Board, with a canMove WIP limit, keyboard moves, and auto-scrolling columns.'
    }
}
