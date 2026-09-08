import type { PageLoad } from './$types'

/** Loads metadata for the transformPagePoint example. */
export const load: PageLoad = () => ({
    title: 'Scaled Drag Board',
    description: 'A zoomable constrained board whose draggable tile stays under the pointer.'
})
