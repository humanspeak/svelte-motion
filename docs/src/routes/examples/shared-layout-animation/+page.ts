import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Shared Layout Animation',
        description:
            'Animate elements between positions using layoutId for smooth shared layout transitions.',
        sourceUrl: 'https://motion.dev/docs/react-layout-animations'
    }
}
