import type { PageLoad } from './$types'

type ExampleEntry = {
    title: string
    description: string
}

const EXAMPLES: Record<string, ExampleEntry> = {
    'animate-presence': {
        title: 'AnimatePresence',
        description: 'Interactive AnimatePresence animation example using Svelte Motion.'
    },
    'animated-button': {
        title: 'Animated Button',
        description: 'Interactive animated button animation example using Svelte Motion.'
    },
    'animated-tabs': {
        title: 'Animated Tabs',
        description: 'Interactive animated tabs animation example using Svelte Motion.'
    },
    'characters-remaining': {
        title: 'Characters Remaining',
        description: 'Interactive characters remaining animation example using Svelte Motion.'
    },
    'color-interpolation': {
        title: 'Color Interpolation',
        description: 'Interactive color interpolation animation example using Svelte Motion.'
    },
    'conic-gradient': {
        title: 'Conic Gradient',
        description: 'Interactive conic gradient animation example using Svelte Motion.'
    },
    'fancy-like-button': {
        title: 'Fancy Like Button',
        description: 'Interactive fancy like button animation example using Svelte Motion.'
    },
    'hover-and-tap': {
        title: 'Hover and Tap',
        description: 'Interactive hover and tap animation example using Svelte Motion.'
    },
    'html-content': {
        title: 'HTML Content',
        description: 'Interactive html content animation example using Svelte Motion.'
    },
    keyframes: {
        title: 'Keyframes',
        description: 'Interactive Keyframes animation example using Svelte Motion.'
    },
    'layout-group': {
        title: 'LayoutGroup',
        description:
            'Scope shared-layout animations to a subtree so sibling regions reusing the same layoutId animate independently.'
    },
    'layout-scroll': {
        title: 'layoutScroll',
        description:
            'Keep FLIP layout animations anchored when the parent container scrolls mid-animation.'
    },
    'motion-path': {
        title: 'Motion Path',
        description: 'Interactive motion path animation example using Svelte Motion.'
    },
    'multi-state-badge': {
        title: 'Multi-State Badge',
        description: 'Interactive multi-state badge animation example using Svelte Motion.'
    },
    'notifications-stack': {
        title: 'Notifications Stack',
        description: 'Interactive notifications stack animation example using Svelte Motion.'
    },
    'path-morphing': {
        title: 'Path Morphing',
        description: 'Interactive path morphing animation example using Svelte Motion.'
    },
    reordering: {
        title: 'Reordering',
        description: 'Interactive Reordering animation example using Svelte Motion.'
    },
    rotate: {
        title: 'Rotate',
        description: 'Interactive Rotate animation example using Svelte Motion.'
    },
    'scroll-progress': {
        title: 'Scroll Progress',
        description: 'Interactive scroll progress animation example using Svelte Motion.'
    },
    'shared-layout-animation': {
        title: 'Shared Layout Animation',
        description: 'Interactive shared layout animation example using Svelte Motion.'
    },
    'style-string': {
        title: 'styleString',
        description: 'Interactive styleString animation example using Svelte Motion.'
    },
    'tab-select': {
        title: 'Tab Select',
        description: 'Interactive tab select animation example using Svelte Motion.'
    },
    'toggle-switch': {
        title: 'Toggle Switch',
        description: 'Interactive toggle switch animation example using Svelte Motion.'
    },
    'use-animate': {
        title: 'useAnimate',
        description: 'Interactive useAnimate animation example using Svelte Motion.'
    },
    'use-animation-frame': {
        title: 'useAnimationFrame',
        description: 'Interactive useAnimationFrame animation example using Svelte Motion.'
    },
    'use-cycle': {
        title: 'useCycle',
        description: 'Interactive useCycle animation example using Svelte Motion.'
    },
    'use-in-view': {
        title: 'useInView',
        description: 'Interactive useInView animation example using Svelte Motion.'
    },
    'use-presence': {
        title: 'usePresence',
        description: 'Interactive usePresence animation example using Svelte Motion.'
    },
    'use-reduced-motion': {
        title: 'useReducedMotion',
        description: 'Interactive useReducedMotion animation example using Svelte Motion.'
    },
    'use-time': {
        title: 'useTime',
        description: 'Interactive useTime animation example using Svelte Motion.'
    },
    'use-time-synced': {
        title: 'useTime (Synced)',
        description: 'Interactive useTime (synced) animation example using Svelte Motion.'
    },
    'variants-basic': {
        title: 'Variants Basic',
        description: 'Interactive variants basic animation example using Svelte Motion.'
    },
    'variants-dynamic': {
        title: 'Variants Dynamic (custom)',
        description:
            'Per-instance variants — function-form factories receive the custom prop, driving staggered index-based delays.'
    },
    'variants-while-hover': {
        title: 'Variants on whileHover',
        description:
            'Pass a variant key (or array) to whileHover, whileTap, whileFocus, whileDrag, or whileInView to reuse named states across gestures.'
    },
    'variants-propagation': {
        title: 'Variants Propagation',
        description: 'Interactive variants propagation animation example using Svelte Motion.'
    },
    'while-focus': {
        title: 'While Focus',
        description: 'Interactive while focus animation example using Svelte Motion.'
    },
    'while-in-view': {
        title: 'While In View',
        description: 'Interactive while in view animation example using Svelte Motion.'
    }
}

export const load: PageLoad = () => ({
    title: 'Examples',
    description:
        'Interactive animation examples built with Svelte Motion. Browse hover effects, transitions, gestures, and more.',
    examples: EXAMPLES
})
