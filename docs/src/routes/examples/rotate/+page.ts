import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Rotate',
        sourceUrl: 'https://examples.motion.dev/react/rotate?utm_source=embed'
    }
}
