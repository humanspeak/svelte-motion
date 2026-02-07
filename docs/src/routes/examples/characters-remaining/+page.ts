import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Characters Remaining',
        description: 'Character counter with spring-based bounce and color-mapped feedback.'
    }
}
