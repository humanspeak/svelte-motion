import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'MotionValue children',
        description: 'Render MotionValue values as live text in motion elements.'
    }
}
