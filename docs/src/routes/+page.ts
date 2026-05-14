import rootPkg from '../../../package.json'
import type { PageLoad } from './$types'

const DEV_TARBALL_BYTES = 96_000

export const load: PageLoad = () => ({
    title: 'Svelte Motion - Animation Library for Svelte',
    description:
        'Svelte Motion is a Framer Motion-compatible animation library for Svelte 5. Spring physics, gestures, layout animations, exit animations, and scroll effects with a familiar declarative API.',
    packageStats: {
        name: rootPkg.name,
        version: rootPkg.version,
        tarballBytes: DEV_TARBALL_BYTES
    }
})
