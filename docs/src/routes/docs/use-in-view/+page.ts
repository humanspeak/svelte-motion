import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'useInView',
    description: 'Track whether an element is in the viewport from a Svelte readable store.'
})
