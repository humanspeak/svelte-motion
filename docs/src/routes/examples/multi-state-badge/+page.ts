import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Multi-State Badge',
        description: 'A badge that cycles through idle, processing, success, and error states.'
    }
}
