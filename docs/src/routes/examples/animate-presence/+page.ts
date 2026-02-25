import type { PageLoad } from './$types'

export const load: PageLoad = () => {
    return {
        title: 'AnimatePresence',
        description: 'Animate components when they are added to or removed from the DOM',
        sourceUrl: 'https://motion.dev/examples/react-exit-animation'
    }
}
