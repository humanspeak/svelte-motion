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

const REPO_BLOB = `https://github.com/${docsConfig.repo}/blob/main`
const EXAMPLES_DIR = 'docs/src/lib/examples'

/**
 * Build the GitHub URL for an example component shipped with the docs site.
 *
 * @param file Filename inside `docs/src/lib/examples/` (e.g. `HoverAndTap.svelte`).
 * @returns Absolute URL to the file on the `main` branch.
 */
export const exampleSourceUrl = (file: string): string => `${REPO_BLOB}/${EXAMPLES_DIR}/${file}`
