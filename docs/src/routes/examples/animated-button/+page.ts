import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Animated Button',
        description: 'Spring-based animated button with press feedback and hover lift.'
    }
}
