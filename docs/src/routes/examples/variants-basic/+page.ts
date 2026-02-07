import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Variants Basic',
        description: 'Define and switch between named animation states with variants.'
    }
}
