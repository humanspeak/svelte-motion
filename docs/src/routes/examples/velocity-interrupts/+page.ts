import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Velocity Interrupts',
        description:
            'Gesture springs that carry momentum across an interrupt — position and velocity both continue into the next animation.'
    }
}
