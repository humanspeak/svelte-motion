import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'useAnimationControls',
        description: 'Coordinate motion components from a shared imperative controller.'
    }
}
