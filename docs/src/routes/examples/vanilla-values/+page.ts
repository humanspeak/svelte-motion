import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Vanilla Values',
        description:
            'Motion values without motion components — runes driving plain elements through styleEffect.'
    }
}
