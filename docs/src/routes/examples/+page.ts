import type { PageLoad } from './$types'

type ExampleEntry = {
    title: string
    description: string
}

const EXAMPLES: Record<string, ExampleEntry> = {
    'armed-buttons': {
        title: 'Armed Buttons',
        description:
            'Production-style archive and delete wait button microinteractions built with Svelte Motion.'
    },
    'animate-presence': {
        title: 'AnimatePresence',
        description: 'Interactive AnimatePresence animation example using Svelte Motion.'
    },
    'animate-presence-custom': {
        title: 'AnimatePresence custom',
        description:
            'Directional exit animations powered by AnimatePresence custom data and dynamic variants.'
    },
    'animated-button': {
        title: 'Animated Button',
        description: 'Interactive animated button animation example using Svelte Motion.'
    },
    'animated-tabs': {
        title: 'Animated Tabs',
        description: 'Interactive animated tabs animation example using Svelte Motion.'
    },
    'ai-gradient-card': {
        title: 'AI Gradient Card',
        description:
            'A rotating conic-gradient border with a masked glow spill, built with useMotionValue, animate, and useMotionTemplate.'
    },
    'ai-glow-border': {
        title: 'Apple Intelligence Glow Border',
        description:
            'Recreate the Apple Intelligence wavy glow border — the Siri glow effect — in Svelte with springs, feTurbulence noise, and SVG displacement.'
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
    'drag-constraints': {
        title: 'Drag Constraints',
        description:
            'A polished constrained-drag stage showing elastic overdrag, ref bounds, and spring settling.'
    },
    'drag-transforms': {
        title: 'Drag Transforms',
        description:
            'Drag translation composed with authored rotate, skew, perspective, and whileDrag transform channels.'
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
    'lazy-motion': {
        title: 'LazyMotion',
        description: 'Load Svelte Motion feature bundles with LazyMotion and the m namespace.'
    },
    'mobile-drawer': {
        title: 'Mobile Drawer',
        description:
            'A theme-aware drag-to-close bottom sheet built with drag, a bound y MotionValue, and dragControls.'
    },
    'motion-path': {
        title: 'Motion Path',
        description: 'Interactive motion path animation example using Svelte Motion.'
    },
    'motion-value-children': {
        title: 'MotionValue children',
        description: 'Render MotionValue values as live text in motion elements.'
    },
    'multi-state-badge': {
        title: 'Multi-State Badge',
        description: 'Interactive multi-state badge animation example using Svelte Motion.'
    },
    'notifications-stack': {
        title: 'Notifications Stack',
        description: 'Interactive notifications stack animation example using Svelte Motion.'
    },
    'optimized-appear': {
        title: 'Optimized appear',
        description: 'Start SSR appear animations before Svelte hydrates the motion runtime.'
    },
    'path-morphing': {
        title: 'Path Morphing',
        description: 'Interactive path morphing animation example using Svelte Motion.'
    },
    reorder: {
        title: 'Reorder',
        description:
            'Drag-to-reorder lists with Reorder.Group and Reorder.Item — FLIP siblings and edge auto-scroll.'
    },
    'vanilla-values': {
        title: 'Vanilla Values',
        description:
            'Motion values without motion components — runes driving plain elements through styleEffect.'
    },
    view: {
        title: 'View Transitions',
        description:
            'Shared-element morphs and enter/exit view layers with animateView and the native View Transitions API.'
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
    'scoped-motion-classes': {
        title: 'Scoped Motion Classes',
        description:
            'Keep component-scoped CSS selectors alive when they are passed to motion components.'
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
    'use-animation-controls': {
        title: 'useAnimationControls',
        description: 'Coordinate motion components from a shared imperative controller.'
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
    'use-presence-data': {
        title: 'usePresenceData',
        description: 'Read AnimatePresence custom data from an entering or exiting child.'
    },
    'use-reduced-motion': {
        title: 'useReducedMotion',
        description: 'Interactive useReducedMotion animation example using Svelte Motion.'
    },
    'use-reduced-motion-config': {
        title: 'useReducedMotionConfig',
        description:
            'Resolve the active reduced-motion policy by combining a parent <MotionConfig> override with the OS preference.'
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
