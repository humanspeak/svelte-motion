import type { PageLoad } from './$types'

export const load: PageLoad = () => {
    // Load example metadata - this could be expanded to read from individual +page.ts files
    // or from a centralized configuration file
    const examples = {
        'animate-presence': {
            title: 'AnimatePresence',
            description: 'Interactive animatepresence animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/examples/react-exit-animation'
        },
        'animated-button': {
            title: 'Animated Button',
            description: 'Interactive animated button animation example using Svelte Motion.',
            sourceUrl: null
        },
        'animated-tabs': {
            title: 'Animated Tabs',
            description: 'Interactive animated tabs animation example using Svelte Motion.',
            sourceUrl: null
        },
        'characters-remaining': {
            title: 'Characters Remaining',
            description: 'Interactive characters remaining animation example using Svelte Motion.',
            sourceUrl: null
        },
        'color-interpolation': {
            title: 'Color Interpolation',
            description: 'Interactive color interpolation animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/docs/motion-animate#color-interpolation'
        },
        'conic-gradient': {
            title: 'Conic Gradient',
            description: 'Interactive conic gradient animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/examples/react-conic-gradient-pointer'
        },
        'fancy-like-button': {
            title: 'Fancy Like Button',
            description: 'Interactive fancy like button animation example using Svelte Motion.',
            sourceUrl: 'https://github.com/DRlFTER/fancyLikeButton'
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
        keyframes: {
            title: 'Keyframes',
            description: 'Interactive keyframes animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/examples/react-keyframes'
        },
        'motion-path': {
            title: 'Motion Path',
            description: 'Interactive motion path animation example using Svelte Motion.',
            sourceUrl: 'https://examples.motion.dev/react/motion-path'
        },
        'multi-state-badge': {
            title: 'Multi-State Badge',
            description: 'Interactive multi-state badge animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/examples/react-multi-state-badge'
        },
        'notifications-stack': {
            title: 'Notifications Stack',
            description: 'Interactive notifications stack animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/examples/react-notifications-stack'
        },
        'path-morphing': {
            title: 'Path Morphing',
            description: 'Interactive path morphing animation example using Svelte Motion.',
            sourceUrl: 'https://examples.motion.dev/react/path-morphing'
        },
        reordering: {
            title: 'Reordering',
            description: 'Interactive reordering animation example using Svelte Motion.',
            sourceUrl: 'https://examples.motion.dev/react/reordering'
        },
        rotate: {
            title: 'Rotate',
            description: 'Interactive rotate animation example using Svelte Motion.',
            sourceUrl: 'https://examples.motion.dev/react/rotate?utm_source=embed'
        },
        'scroll-progress': {
            title: 'Scroll Progress',
            description: 'Interactive scroll progress animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/docs/react-use-scroll'
        },
        'shared-layout-animation': {
            title: 'Shared Layout Animation',
            description:
                'Interactive shared layout animation animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/docs/react-layout-animations'
        },
        'style-string': {
            title: 'styleString',
            description: 'Interactive stylestring animation example using Svelte Motion.',
            sourceUrl: null
        },
        'tab-select': {
            title: 'Tab Select',
            description: 'Interactive tab select animation example using Svelte Motion.',
            sourceUrl: 'https://examples.motion.dev/react/tab-select'
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
        'use-reduced-motion': {
            title: 'useReducedMotion',
            description: 'Interactive usereducedmotion animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/docs/react-use-reduced-motion'
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
        'variants-basic': {
            title: 'Variants Basic',
            description: 'Interactive variants basic animation example using Svelte Motion.',
            sourceUrl: null
        },
        'variants-propagation': {
            title: 'Variants Propagation',
            description: 'Interactive variants propagation animation example using Svelte Motion.',
            sourceUrl: null
        },
        'while-focus': {
            title: 'While Focus',
            description: 'Interactive while focus animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/docs/react-motion-component#focus'
        },
        'while-in-view': {
            title: 'While In View',
            description: 'Interactive while in view animation example using Svelte Motion.',
            sourceUrl: 'https://motion.dev/docs/react-motion-component#scroll'
        }
    }

    return {
        title: 'Examples',
        description:
            'Interactive animation examples built with Svelte Motion. Browse hover effects, transitions, gestures, and more.',
        examples
    }
}
