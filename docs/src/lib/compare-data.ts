import type { ComparisonOurs, Competitor } from '@humanspeak/docs-kit'

export type { ComparisonFeature, ComparisonOurs, Competitor } from '@humanspeak/docs-kit'

/**
 * Brand identity passed to `CompareIndexV2` + `ComparisonPageV2` on every
 * /compare route. Keeping the literal here (not at each call site) means
 * changing the canonical URL once updates the index page, every
 * /compare/<slug> page, and the JSON-LD inside them.
 */
export const ours: ComparisonOurs = {
    name: 'Svelte Motion',
    npmPackage: '@humanspeak/svelte-motion',
    slug: 'svelte-motion',
    url: 'https://motion.svelte.page'
}

const shared = {
    prosUs: [
        'Svelte 5 runes-native — built for runes, not retrofitted',
        'Framer Motion-compatible API for component code (props, semantics, AnimatePresence, variants)',
        '~170 motion.<tag> proxy components covering every HTML and SVG element',
        'Full gesture set: whileHover, whileTap, whileFocus, whileInView',
        'Drag gesture with constraints, momentum, elastic, snap-to-origin, axis lock',
        'FLIP layout animation and shared layoutId out of the box',
        'Spring physics, scroll-linked motion values, and reactive useMotionValue / useTransform',
        'SSR-safe by default — initial state renders server-side, hydrates without flicker',
        'Tree-shakeable Motion<Tag> named exports for bundle-size-critical apps',
        'TypeScript-first with full type safety across motion props, drag, variants, and hooks',
        'MIT licensed — no commercial tier, no paid plugin gates'
    ],
    consUs: [
        'Requires Svelte 5 + runes (no Svelte 4 / legacy stores support)',
        'Newer project — smaller community than the React Framer Motion ecosystem',
        'transition.staggerChildren orchestrator not yet wired — drive cascades with per-child delay'
    ]
}

export const competitors: Competitor[] = [
    {
        slug: 'framer-motion',
        name: 'Framer Motion',
        tagline: 'Framer Motion is React-only. Svelte Motion is its Svelte 5 counterpart.',
        description:
            'Framer Motion is the canonical declarative animation library for React. @humanspeak/svelte-motion is the Svelte 5 counterpart — same prop names, same component model (motion.<tag>, AnimatePresence, variants), same gestures, same FLIP layout animation, same spring physics. Different framework underneath.',
        website: 'https://www.framer.com/motion',
        github: 'https://github.com/framer/motion',
        npm: 'framer-motion',
        type: 'React Animation Library',
        approach: 'Declarative components (React-only)',
        features: [
            { name: 'motion.<tag> proxies (HTML + SVG)', us: '~170 tags', them: '~170 tags' },
            { name: 'Tree-shakeable named exports (MotionDiv, …)', us: true, them: false },
            { name: 'AnimatePresence (sync / wait / popLayout)', us: true, them: true },
            { name: 'Variants with parent → child propagation', us: true, them: true },
            { name: 'whileHover / whileTap / whileFocus / whileInView', us: true, them: true },
            { name: 'Drag (constraints, momentum, elastic, snap)', us: true, them: true },
            { name: 'FLIP layout / layout="position"', us: true, them: true },
            { name: 'Shared layout via layoutId', us: true, them: true },
            { name: 'Spring physics', us: true, them: true },
            { name: 'Scroll-linked motion values', us: true, them: true },
            { name: 'useAnimate imperative scoped animations', us: true, them: true },
            { name: 'MotionConfig provider', us: true, them: true },
            { name: 'useReducedMotion / useReducedMotionConfig', us: true, them: true },
            { name: 'usePresence / useIsPresent custom exit', us: true, them: true },
            { name: 'Framework', us: 'Svelte 5', them: 'React only' },
            {
                name: 'staggerChildren orchestrator on parent variants',
                us: 'Per-child delay pattern',
                them: true,
                note: 'Svelte Motion expects you to drive the cascade with a per-child transition.delay; the parent-level orchestrator is not yet wired.'
            },
            {
                name: 'Reactivity model',
                us: 'Svelte 5 runes (stores read with $)',
                them: 'React hooks'
            }
        ],
        prosUs: [
            ...shared.prosUs,
            'Drop-in API for migrating React component code to Svelte 5',
            'No JSX → Svelte syntax gotchas on the animation props themselves'
        ],
        prosThem: [
            'The canonical declarative animation library on React — battle-tested at scale',
            'Massive community, plugin ecosystem, and reference content',
            'Parent-level staggerChildren orchestrator handles cascades automatically',
            'Direct integration with Framer (the design tool) for design → code workflows'
        ],
        consUs: [...shared.consUs],
        consThem: [
            'React-only — cannot be used in Svelte, Vue, or vanilla JS projects',
            'Adds React + ReactDOM as runtime dependencies',
            'JSX-based mental model — different from Svelte template syntax'
        ],
        verdict:
            'If you are building in React, use Framer Motion. If you are building in Svelte 5 (or migrating from React + Framer Motion), use @humanspeak/svelte-motion — it is the closest behavioural match on Svelte 5 and the recommended migration target.',
        keywords: [
            'framer motion svelte',
            'framer motion alternative svelte',
            'framer motion for svelte',
            'svelte framer motion',
            'react framer motion migration'
        ]
    },
    {
        slug: 'motion-one',
        name: 'Motion One',
        tagline:
            'Motion One is the imperative engine. Svelte Motion is the declarative layer on top.',
        description:
            "motion (formerly Motion One, now branded motion.dev) is a framework-agnostic, imperative animation engine. @humanspeak/svelte-motion is the declarative Svelte 5 component API built on top of it. We re-export Motion's imperative helpers so you do not need a second dependency.",
        website: 'https://motion.dev',
        github: 'https://github.com/motiondivision/motion',
        npm: 'motion',
        type: 'Imperative animation engine',
        approach: 'Framework-agnostic, function-call API',
        features: [
            { name: 'animate(el, keyframes, opts)', us: 'Re-exported', them: true },
            { name: 'Framework-specific component layer', us: 'Yes (Svelte 5)', them: false },
            { name: 'motion.<tag> declarative proxies', us: '~170 tags', them: false },
            { name: 'AnimatePresence exit animations', us: true, them: false },
            {
                name: 'whileHover / whileTap / whileFocus',
                us: true,
                them: false,
                note: 'Motion ships imperative hover() / press() helpers; the whileX prop pattern lives in the Svelte layer.'
            },
            {
                name: 'whileInView',
                us: true,
                them: 'inView() helper',
                note: 'Motion has an imperative inView() helper; Svelte Motion exposes it as a whileInView prop.'
            },
            { name: 'Drag (constraints / momentum / elastic)', us: true, them: false },
            { name: 'FLIP layout animation (layout prop)', us: true, them: false },
            { name: 'Shared layoutId animation', us: true, them: false },
            { name: 'Variants with propagation', us: true, them: false },
            { name: 'Spring physics', us: true, them: true },
            {
                name: 'Scroll-linked motion values',
                us: 'useScroll + useTransform',
                them: 'scroll()'
            },
            { name: 'Reactive motion values (useMotionValue)', us: true, them: false },
            { name: 'MotionConfig provider', us: true, them: false },
            { name: 'Framework', us: 'Svelte 5', them: 'Framework-agnostic' },
            { name: 'Engine', us: 'Built on motion', them: 'motion (self)' }
        ],
        prosUs: [
            ...shared.prosUs,
            'Declarative prop-based API — set props, framework reconciles',
            'Component lifecycle, gesture state, and presence handled automatically',
            "Re-exports motion's imperative API — no second dependency needed for one-shot effects"
        ],
        prosThem: [
            'Framework-agnostic — works in vanilla JS, Web Components, any framework',
            'Tiny imperative core — minimal bundle if you only need a few effects',
            'Best fit for ad-hoc, fire-and-forget effects from event handlers',
            'Maintained by the original Framer Motion team',
            'Direct timeline / chain composition without component overhead'
        ],
        consUs: [...shared.consUs],
        consThem: [
            'No declarative component layer — you wire DOM refs and lifecycle yourself',
            'No AnimatePresence — exit animations require manual unmount delay',
            'No drag with constraints / momentum / elastic out of the box',
            'No FLIP layout or shared layoutId animation',
            'No reactive motion values — you manage subscriptions manually'
        ],
        verdict:
            'These are layers of the same stack, not competitors. Reach for motion / motion.dev for vanilla-JS projects or one-shot imperative effects. Reach for @humanspeak/svelte-motion when you are building Svelte 5 components that need declarative animation, gestures, AnimatePresence, drag, or layout — the same engine runs underneath, with the Svelte component model on top.',
        keywords: [
            'motion one svelte',
            'motion.dev svelte',
            'motion svelte',
            'svelte motion library',
            'motion vs framer motion'
        ]
    },
    {
        slug: 'gsap',
        name: 'GSAP',
        tagline:
            'GSAP is a timeline engine. Svelte Motion is a component library. Different problems.',
        description:
            'GSAP is the heavyweight timeline engine for the web — imperative, plugin-rich, and mature. @humanspeak/svelte-motion is a declarative component library for Svelte 5 — gestures, layout, presence, variants, drag. There is overlap (both can tween a property), but each is shaped around a different model of how UI animation works.',
        website: 'https://gsap.com',
        github: 'https://github.com/greensock/GSAP',
        npm: 'gsap',
        type: 'Imperative timeline engine',
        approach: 'gsap.to() / gsap.timeline() / plugins',
        features: [
            { name: 'Tween any CSS property', us: true, them: true },
            { name: 'Spring physics', us: 'type: "spring"', them: 'Manual / RoughEase' },
            { name: 'Timelines with scrub / labels / nesting', us: false, them: 'Best-in-class' },
            { name: 'Declarative motion.<tag> components', us: '~170 tags', them: false },
            { name: 'AnimatePresence exit animations', us: true, them: false },
            {
                name: 'whileHover / whileTap / whileFocus / whileInView',
                us: true,
                them: false,
                note: 'GSAP requires manual pointer / IntersectionObserver wiring.'
            },
            {
                name: 'Drag with constraints / momentum / elastic',
                us: 'Built in (drag prop)',
                them: 'Draggable plugin'
            },
            {
                name: 'FLIP layout animation',
                us: 'layout / layout="position"',
                them: 'Flip plugin (imperative)'
            },
            { name: 'Shared layout (layoutId)', us: true, them: false },
            { name: 'Variants with parent → child propagation', us: true, them: false },
            {
                name: 'ScrollTrigger (pin / scrub / snap)',
                us: 'Partial (useScroll + useTransform)',
                them: 'Best-in-class'
            },
            {
                name: 'MorphSVG path morphing',
                us: 'motion.path + flubber',
                them: 'MorphSVGPlugin (paid)'
            },
            { name: 'Reactive motion values', us: true, them: false },
            { name: 'License', us: 'MIT', them: 'Standard free + Club GSAP (paid plugins)' },
            { name: 'Framework integration', us: 'Native Svelte 5', them: 'Framework-agnostic' }
        ],
        prosUs: [
            ...shared.prosUs,
            'Declarative props for hover / tap / focus / in-view — no listener plumbing',
            'AnimatePresence handles exit animations without manual unmount delay',
            'FLIP layout and shared layoutId animate component-level box changes automatically',
            'No paid plugin tier — every feature ships in the MIT-licensed core'
        ],
        prosThem: [
            'Timeline orchestration is genuinely best-in-class — scrubbing, labels, nesting, reverse',
            'Deep plugin ecosystem: ScrollTrigger, Flip, MorphSVG, Draggable, SplitText, Observer',
            'Decade-plus of production hardening across thousands of sites',
            'Ad-tech and creative-coding industry standard',
            'Detailed control over every easing curve and motion path'
        ],
        consUs: [
            ...shared.consUs,
            'Timeline orchestration is shallower than GSAP — no scrub / label / nested timeline equivalents'
        ],
        consThem: [
            'Imperative API — you own DOM refs, lifecycle, and gesture state machines',
            'No declarative gesture props (whileHover / whileTap / whileFocus / whileInView)',
            'No AnimatePresence equivalent — manual unmount delay required',
            'No shared-layout (layoutId) animation pattern',
            'Some marquee plugins (MorphSVG, SplitText, Physics2D) are paid (Club GSAP)',
            'Larger bundle once you add ScrollTrigger / Flip / Draggable'
        ],
        verdict:
            'Choose GSAP when you need its timeline depth, ScrollTrigger pinning, MorphSVG, or already have a GSAP-comfortable team. Choose @humanspeak/svelte-motion for declarative component-level animation in Svelte 5 — gestures, presence, layout, drag. The two can coexist in the same app: Svelte Motion for UI animation, GSAP when you need its timeline engine.',
        keywords: [
            'gsap svelte',
            'svelte gsap alternative',
            'gsap vs framer motion',
            'svelte timeline animation',
            'gsap vs svelte motion'
        ]
    }
]

export function getCompetitor(slug: string): Competitor | undefined {
    return competitors.find((c) => c.slug === slug)
}
