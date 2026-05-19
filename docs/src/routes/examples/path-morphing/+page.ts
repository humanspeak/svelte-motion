import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Path Morphing',
        description:
            'Interactive path morphing animation using SVG shape interpolation with Svelte Motion.'
    }
}
