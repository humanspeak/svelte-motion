import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'MotionConfig',
    description:
        'Component that supplies transition, reduced-motion, animation-skip, and coordinate-correction behavior to descendant motion components.'
})
