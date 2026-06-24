import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'useWillChange',
    description:
        'Auto-managed CSS will-change that starts at auto and latches to transform after a qualifying animation.'
})
