import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Toggle Switch',
        sourceUrl: null
    }
}
