import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Multi-State Badge',
        sourceUrl: 'https://motion.dev/examples/react-multi-state-badge'
    }
}
