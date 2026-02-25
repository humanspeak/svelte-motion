import type { PageLoad } from './$types'

export const load: PageLoad = () => {
    return {
        title: 'Conic Gradient',
        description: 'Pointer-tracking conic gradient using useTransform',
        sourceUrl: 'https://motion.dev/examples/react-conic-gradient-pointer'
    }
}
