import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'useAnimationFrame',
        sourceUrl: 'https://motion.dev/docs/react-use-animation-frame'
    }
}
