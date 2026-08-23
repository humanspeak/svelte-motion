import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'Migrate from svelte-motion to Svelte Motion',
    description:
        'Move from the dormant svelte-motion package to @humanspeak/svelte-motion for Svelte 5 runes, AnimatePresence, gestures, drag, layout animations, and SSR-safe SvelteKit support.'
})
