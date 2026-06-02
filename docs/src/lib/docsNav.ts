import type { NavSection } from '@humanspeak/docs-kit'
import {
    Accessibility,
    Activity,
    ArrowUpDown,
    BookText,
    Box,
    Clock,
    Code,
    Columns2,
    Compass,
    Eye,
    Gauge,
    Ghost,
    Hand,
    Layers,
    MousePointer,
    Move,
    Play,
    RefreshCw,
    Settings,
    Signal,
    SlidersHorizontal,
    Timer,
    Wand,
    Zap
} from '@lucide/svelte'

export const docsSections: NavSection[] = [
    {
        title: 'Get started',
        icon: Play,
        items: [{ title: 'Get started', href: '/docs', icon: Play, exact: true }]
    },
    {
        title: 'Components',
        icon: Ghost,
        items: [
            { title: 'AnimatePresence', href: '/docs/animate-presence', icon: Ghost },
            {
                title: 'AnimatePresence custom',
                href: '/docs/animate-presence-custom',
                icon: ArrowUpDown
            },
            { title: 'LazyMotion', href: '/docs/lazy-motion', icon: Zap },
            { title: 'MotionConfig', href: '/docs/motion-config', icon: Settings }
        ]
    },
    {
        title: 'Animation',
        icon: Layers,
        items: [
            { title: 'Layout Animations', href: '/docs/layout-animations', icon: Move },
            { title: 'Variants', href: '/docs/variants', icon: Layers }
        ]
    },
    {
        title: 'Gestures',
        icon: Hand,
        items: [
            { title: 'Gestures (overview)', href: '/docs/gestures', icon: Hand },
            { title: 'Drag', href: '/docs/drag', icon: Hand },
            { title: 'Pan', href: '/docs/pan', icon: Hand }
        ]
    },
    {
        title: 'Motion values',
        icon: Signal,
        items: [
            { title: 'Overview', href: '/docs/motion-values', icon: Signal },
            { title: 'useFollowValue', href: '/docs/use-follow-value', icon: Activity },
            { title: 'useMotionTemplate', href: '/docs/use-motion-template', icon: Code },
            { title: 'useMotionValueEvent', href: '/docs/use-motion-value-event', icon: Zap },
            { title: 'useScroll', href: '/docs/use-scroll', icon: ArrowUpDown },
            { title: 'useSpring', href: '/docs/use-spring', icon: Activity },
            { title: 'useTime', href: '/docs/use-time', icon: Timer },
            { title: 'useTransform', href: '/docs/use-transform', icon: SlidersHorizontal },
            { title: 'useVelocity', href: '/docs/use-velocity', icon: Gauge }
        ]
    },
    {
        title: 'Hooks',
        icon: Clock,
        items: [
            { title: 'useAnimate', href: '/docs/use-animate', icon: Play },
            {
                title: 'useAnimationControls',
                href: '/docs/use-animation-controls',
                icon: Play
            },
            { title: 'useAnimationFrame', href: '/docs/use-animation-frame', icon: Clock },
            { title: 'useCycle', href: '/docs/use-cycle', icon: RefreshCw },
            { title: 'useInView', href: '/docs/use-in-view', icon: Eye },
            { title: 'usePresence', href: '/docs/use-presence', icon: Ghost },
            {
                title: 'useReducedMotion',
                href: '/docs/use-reduced-motion',
                icon: Accessibility
            },
            {
                title: 'useReducedMotionConfig',
                href: '/docs/use-reduced-motion-config',
                icon: Accessibility
            }
        ]
    },
    {
        title: 'Utilities',
        icon: Wand,
        items: [{ title: 'styleString', href: '/docs/style-string', icon: Wand }]
    },
    {
        title: 'Reference',
        icon: BookText,
        items: [{ title: 'API Reference', href: '/docs/api-reference', icon: BookText }]
    },
    {
        title: 'Performance',
        icon: Zap,
        items: [
            { title: 'Optimized appear', href: '/docs/optimized-appear', icon: Zap },
            { title: 'Tree Shaking', href: '/docs/tree-shaking', icon: Zap }
        ]
    },
    {
        title: 'shadcn/ui',
        icon: MousePointer,
        items: [
            { title: 'Button', href: '/docs/shadcn-button', icon: MousePointer },
            { title: 'Tabs', href: '/docs/shadcn-tabs', icon: Columns2 }
        ]
    }
]

export const motionLoveAndRespect = [
    { title: 'Beye.ai', href: 'https://beye.ai', external: true },
    { title: 'Emil', href: 'https://animations.dev/', icon: Compass, external: true },
    {
        title: 'shadcn-svelte',
        href: 'https://www.shadcn-svelte.com',
        icon: Box,
        external: true
    }
]
