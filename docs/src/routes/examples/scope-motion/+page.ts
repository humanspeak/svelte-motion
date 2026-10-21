import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'useScopeMotion',
        description:
            'Motion 14.5 scopes in Svelte with useScopeMotion — a staggered list that re-runs on a breakpoint, and a reset button that cancels every animation and restores inline styles.'
    }
}
