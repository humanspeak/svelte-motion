import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Animated Button',
        sourceUrl: 'https://examples.motion.dev/react/animated-button?utm_source=embed'
    }
}
