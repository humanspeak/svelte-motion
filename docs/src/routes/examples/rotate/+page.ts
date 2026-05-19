import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Rotate',
        description: 'Continuous rotation animation with configurable easing.'
    }
}
