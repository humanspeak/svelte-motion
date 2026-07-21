import type { PageLoad } from './$types'

export const load: PageLoad = () => {
    return {
        title: 'Grid Exit',
        description:
            'Remove cards from a CSS grid with exit animations that hold their slot, then FLIP the survivors into place'
    }
}
