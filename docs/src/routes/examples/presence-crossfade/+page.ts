import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Presence Crossfade',
        description:
            'A card that closes back into its thumbnail: exiting layoutId elements crossfade with AnimatePresence.'
    }
}
