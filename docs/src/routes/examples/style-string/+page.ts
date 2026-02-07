import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'styleString',
        description: 'Reactive style strings with automatic unit handling via styleString.'
    }
}
