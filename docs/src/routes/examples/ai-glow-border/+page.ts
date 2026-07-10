import type { PageLoad } from './$types'

export const load: PageLoad = () => {
    return {
        title: 'Apple Intelligence Glow Border',
        description:
            'Recreate the Apple Intelligence wavy glow border — the Siri screen-edge glow effect — in Svelte with spring physics, feTurbulence noise, and SVG displacement.'
    }
}
