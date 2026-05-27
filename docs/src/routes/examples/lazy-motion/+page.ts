import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'LazyMotion',
        description: 'Load Svelte Motion feature bundles with LazyMotion and the m namespace.'
    }
}
