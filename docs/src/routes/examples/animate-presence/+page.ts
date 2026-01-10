import type { PageLoad } from './$types'

export const load: PageLoad = () => {
    return {
        title: 'AnimatePresence',
        description: 'Animate components when they are added to or removed from the DOM',
        sourceUrl:
            'https://github.com/humanspeak/svelte-motion/tree/main/docs/src/routes/examples/animate-presence'
    }
}
