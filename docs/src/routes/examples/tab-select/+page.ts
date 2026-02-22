import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Tab Select',
        description:
            'Animated tab selector using layoutId for a shared indicator that slides between tabs.',
        sourceUrl: 'https://examples.motion.dev/react/tab-select'
    }
}
