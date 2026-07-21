import { EXAMPLES } from '$lib/examplesIndex'
import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'Examples',
    description:
        'Interactive animation examples built with Svelte Motion. Browse hover effects, transitions, gestures, and more.',
    examples: EXAMPLES
})
