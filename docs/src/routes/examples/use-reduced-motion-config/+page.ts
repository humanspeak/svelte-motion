import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'useReducedMotionConfig',
        description:
            'Resolve the active reduced-motion policy by combining a parent <MotionConfig> override with the OS preference.'
    }
}
