import type { PageLoad } from './$types'

export const load: PageLoad = () => {
    return {
        title: 'While In View',
        description: 'Animate elements when they enter or leave the viewport'
    }
}
