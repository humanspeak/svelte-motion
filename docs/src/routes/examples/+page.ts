import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
    // Load example metadata - this could be expanded to read from individual +page.ts files
    // or from a centralized configuration file
    const examples = {
        'animated-button': {
            title: 'Animated Button',
            description: 'Interactive animated button animation example using Svelte Motion.',
            sourceUrl: null
        },
        'color-interpolation': {
            title: 'Color Interpolation',
            description: 'Interactive color interpolation animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/docs/motion-animate#color-interpolation'
        },
        'hover-and-tap': {
            title: 'Hover and Tap',
            description: 'Interactive hover and tap animation example using Svelte Motion.',
            sourceUrl: 'https://examples.motion.dev/react/gestures'
        },
        'html-content': {
            title: 'HTML Content',
            description: 'Interactive html content animation example using Svelte Motion.',
            sourceUrl: 'https://examples.motion.dev/react/html-content'
        },
        'notifications-stack': {
            title: 'Notifications Stack',
            description: 'Interactive notifications stack animation example using Svelte Motion.',
            sourceUrl:
                'https://github.com/humanspeak/svelte-motion/tree/main/docs/src/routes/examples/notifications-stack'
        },
        rotate: {
            title: 'Rotate',
            description: 'Interactive rotate animation example using Svelte Motion.',
            sourceUrl: 'https://examples.motion.dev/react/rotate?utm_source=embed'
        },
        'toggle-switch': {
            title: 'Toggle Switch',
            description: 'Interactive toggle switch animation example using Svelte Motion.',
            sourceUrl: null
        },
        'use-animation-frame': {
            title: 'useAnimationFrame',
            description: 'Interactive useanimationframe animation example using Svelte Motion.',
            sourceUrl: 'https://examples.motion.dev/react/use-animation-frame'
        },
        'use-time': {
            title: 'useTime',
            description: 'Interactive usetime animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/docs/react-use-time'
        },
        'use-time-synced': {
            title: 'useTime (Synced)',
            description: 'Interactive usetime (synced) animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/docs/react-use-time'
        },
        'while-focus': {
            title: 'While Focus',
            description: 'Interactive while focus animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/docs/react-motion-component#focus'
        }
    }

    return {
        examples
    }
}
