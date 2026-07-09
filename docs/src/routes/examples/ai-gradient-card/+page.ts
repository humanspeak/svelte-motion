import type { PageLoad } from './$types'

export const load: PageLoad = () => {
    return {
        title: 'AI Gradient Card',
        description:
            'An animated conic-gradient border and glow spill built with useMotionValue, animate, and useMotionTemplate.'
    }
}
