import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Armed Buttons',
        description:
            'Production-style archive and delete wait button microinteractions built with Svelte Motion.'
    }
}
