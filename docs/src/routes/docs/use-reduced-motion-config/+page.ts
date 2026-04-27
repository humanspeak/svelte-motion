import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'useReducedMotionConfig',
    description:
        "Resolve the active reduced-motion policy from MotionConfig and the user's OS preference."
})
