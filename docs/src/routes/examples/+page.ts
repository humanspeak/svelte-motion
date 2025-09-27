import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    // Load example metadata - this could be expanded to read from individual +page.ts files
    // or from a centralized configuration file
    const examples = {
        'animated-button': {
            title: 'Animated Button',
            description: 'Interactive animated button animation example using Svelte Motion.',
            sourceUrl: 'https://examples.motion.dev/react/animated-button?utm_source=embed'
        },
        'hover-and-tap': {
            title: 'Hover and Tap',
            description: 'Interactive hover and tap animation example using Svelte Motion.',
            sourceUrl: 'https://examples.motion.dev/react/gestures'
        },
        rotate: {
            title: 'Rotate',
            description: 'Interactive rotate animation example using Svelte Motion.',
            sourceUrl: 'https://examples.motion.dev/react/rotate?utm_source=embed'
        }
    }

    return {
        examples
    }
}
