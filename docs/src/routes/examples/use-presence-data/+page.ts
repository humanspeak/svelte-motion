import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'usePresenceData',
        description: 'Read AnimatePresence custom data from an exiting child.'
    }
}
