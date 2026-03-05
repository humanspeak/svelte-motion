import type { NavSection } from '@humanspeak/docs-kit'
import {
    Activity,
    ArrowUpDown,
    Box,
    Clock,
    Code,
    Columns2,
    Compass,
    Gauge,
    Ghost,
    Hand,
    Layers,
    MousePointer,
    Move,
    Play,
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
        items: [{ title: 'Get started', href: '/docs', icon: Play }]
    },
    {
        title: 'Components',
        icon: Ghost,
        items: [{ title: 'AnimatePresence', href: '/docs/animate-presence', icon: Ghost }]
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
        items: [{ title: 'Drag', href: '/docs/drag', icon: Hand }]
    },
    {
        title: 'Motion values',
        icon: Signal,
        items: [
            { title: 'Overview', href: '/docs/motion-values', icon: Signal },
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
        items: [{ title: 'useAnimationFrame', href: '/docs/use-animation-frame', icon: Clock }]
    },
    {
        title: 'Utilities',
        icon: Wand,
        items: [{ title: 'styleString', href: '/docs/style-string', icon: Wand }]
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
