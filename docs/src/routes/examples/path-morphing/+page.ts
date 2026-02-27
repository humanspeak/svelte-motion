import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Path Morphing',
        description:
            'Interactive path morphing animation using SVG shape interpolation with Svelte Motion.',
        sourceUrl: 'https://examples.motion.dev/react/path-morphing'
    }
}
