import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'useReducedMotion',
        description: "Honor the user's prefers-reduced-motion accessibility setting."
    }
}
