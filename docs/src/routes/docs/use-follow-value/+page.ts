import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'useFollowValue',
    description:
        'Create a MotionValue that animates to its latest value using any transition type — spring, tween, inertia, or keyframes.'
})
