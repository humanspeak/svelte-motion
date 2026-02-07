import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Variants Propagation',
        description: 'Propagate variant animations through nested component trees.'
    }
}
