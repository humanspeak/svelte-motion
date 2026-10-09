import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    return {
        title: 'animateLayout',
        description:
            'Layout animations on plain elements with animateLayout — a switch knob, a shared tab underline, and a shuffled grid, no motion components.'
    }
}
