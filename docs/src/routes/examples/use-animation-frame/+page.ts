import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'useAnimationFrame',
        description: 'Run animations on every frame with useAnimationFrame.',
        sourceUrl: 'https://examples.motion.dev/react/use-animation-frame'
    }
}
