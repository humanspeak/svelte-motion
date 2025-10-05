import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'useAnimationFrame',
        sourceUrl: 'https://examples.motion.dev/react/use-animation-frame'
    }
}
