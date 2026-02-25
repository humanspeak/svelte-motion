import type { PageLoad } from './$types'

export const load: PageLoad = () => {
    return {
        title: 'Keyframes',
        description: 'Multi-property keyframe animation with scale, rotate, and borderRadius',
        sourceUrl: 'https://motion.dev/examples/react-keyframes'
    }
}
