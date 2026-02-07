import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Hover and Tap',
        description: 'Gesture-driven animations for hover and tap interactions.',
        sourceUrl: 'https://examples.motion.dev/react/gestures'
    }
}
