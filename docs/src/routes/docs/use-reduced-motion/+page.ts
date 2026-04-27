import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'useReducedMotion',
    description:
        "Reactive Svelte store for the user's prefers-reduced-motion accessibility preference."
})
