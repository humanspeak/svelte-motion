import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Hover and Tap',
        sourceUrl: 'https://examples.motion.dev/react/gestures'
    }
}
