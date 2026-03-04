import type { DocsKitConfig } from '@humanspeak/docs-kit'

export const docsConfig: DocsKitConfig = {
    name: 'Svelte Motion',
    slug: 'motion',
    npmPackage: '@humanspeak/svelte-motion',
    repo: 'humanspeak/svelte-motion',
    url: 'https://motion.svelte.page',
    description:
        'Svelte Motion is a Framer Motion-compatible animation library for Svelte 5. Spring physics, gestures, layout animations, exit animations, and scroll effects with a familiar declarative API.',
    keywords: [
        'svelte',
        'animation',
        'motion',
        'framer-motion',
        'spring',
        'gestures',
        'layout',
        'scroll',
        'svelte-5',
        'typescript'
    ],
    defaultFeatures: ['AnimatePresence', 'Spring Physics', 'Gestures & Drag', 'Layout Animation'],
    fallbackStars: 200
}
