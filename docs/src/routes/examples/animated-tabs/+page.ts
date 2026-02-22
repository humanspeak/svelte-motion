import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Animated Tabs',
        description:
            'Spring-based animated tabs with a sliding indicator powered by svelte-motion layoutId and bits-ui.'
    }
}
