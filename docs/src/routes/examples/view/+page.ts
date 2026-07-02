import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'View Transitions',
        description:
            'Shared-element morphs and enter/exit view layers with animateView and the native View Transitions API.'
    }
}
