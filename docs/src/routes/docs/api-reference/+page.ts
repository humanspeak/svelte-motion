import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'API Reference',
    description:
        "Exported TypeScript types, motion re-exports, SSR behavior, and other surface-area details that don't belong on a per-hook page."
})
