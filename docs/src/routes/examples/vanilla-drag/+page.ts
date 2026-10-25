import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'Vanilla drag()',
        description:
            'Motion 14.4 drag() on a plain element in Svelte — a slider knob constrained to its track, reset with animate() because both share the knob’s x value.'
    }
}
