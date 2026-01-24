import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'While In View',
        sourceUrl: 'https://motion.dev/docs/react-motion-component#scroll'
    }
}
