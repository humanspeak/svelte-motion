<script lang="ts">
    import { HeaderV2, FooterV2, getBreadcrumbContext, getSeoContext } from '@humanspeak/docs-kit'
    import { docsConfig } from '$lib/docs-config'
    import favicon from '$lib/assets/logo.svg'
    import rootPkg from '../../../../package.json'
    import '@fontsource-variable/inter/index.css'
    import '@fontsource-variable/jetbrains-mono/index.css'

    const PKG_VERSION = rootPkg.version

    const breadcrumbs = getBreadcrumbContext()
    if (breadcrumbs) breadcrumbs.breadcrumbs = [{ title: 'Svelte Animations' }]

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'Svelte Animations · Every Svelte 5 animation pattern | Svelte Motion'
        seo.description =
            'Every Svelte 5 animation pattern in one place — gestures, exit animations, layout animation, variants, drag, scroll-linked motion values, SVG paths, and hooks. Built with @humanspeak/svelte-motion, the Framer Motion-compatible animation library for Svelte 5.'
        seo.ogTitle = 'Svelte Animations'
        seo.ogTagline = 'Every Svelte 5 animation pattern, in one place.'
        seo.ogFeatures = [
            'Gestures',
            'Exit Animations',
            'Layout & Shared Layout',
            'Variants & Orchestration'
        ]
        seo.ogSlug = 'svelte-animations'
    }

    type Example = { slug: string; title: string; line: string }
    type Group = { key: string; label: string; blurb: string; items: Example[] }

    const groups: Group[] = [
        {
            key: 'gestures',
            label: 'GESTURES',
            blurb: 'whileHover, whileTap, whileFocus, whileInView — one prop, full gesture state.',
            items: [
                {
                    slug: 'hover-and-tap',
                    title: 'Hover & Tap',
                    line: 'whileHover + whileTap on a single motion.button with spring physics.'
                },
                {
                    slug: 'while-focus',
                    title: 'While Focus',
                    line: 'Focus-state animation for accessible interactive elements.'
                },
                {
                    slug: 'while-in-view',
                    title: 'While In View',
                    line: 'Trigger animation when an element enters the viewport.'
                },
                {
                    slug: 'fancy-like-button',
                    title: 'Fancy Like Button',
                    line: 'Multi-state gesture with delight detail — tap, count, particles.'
                }
            ]
        },
        {
            key: 'presence',
            label: 'PRESENCE & EXIT',
            blurb: 'AnimatePresence with mode="sync" | "wait" | "popLayout" for mount and unmount.',
            items: [
                {
                    slug: 'animate-presence',
                    title: 'AnimatePresence',
                    line: 'Enter and exit animations for conditionally-rendered elements.'
                },
                {
                    slug: 'multi-state-badge',
                    title: 'Multi-State Badge',
                    line: 'Cross-fade between badge states with synchronized transitions.'
                },
                {
                    slug: 'notifications-stack',
                    title: 'Notifications Stack',
                    line: 'Stacked toasts with staggered enter / exit and shared layout.'
                },
                {
                    slug: 'use-presence',
                    title: 'usePresence',
                    line: 'Custom exit choreography with safeToRemove and isPresent.'
                }
            ]
        },
        {
            key: 'layout',
            label: 'LAYOUT & SHARED LAYOUT',
            blurb: 'FLIP-based layout animation and shared-layout transitions via layoutId.',
            items: [
                {
                    slug: 'shared-layout-animation',
                    title: 'Shared Layout',
                    line: 'Animate between two elements anywhere in the DOM with shared layoutId.'
                },
                {
                    slug: 'reordering',
                    title: 'Reordering',
                    line: 'Smooth FLIP transitions as list items shuffle.'
                },
                {
                    slug: 'animated-tabs',
                    title: 'Animated Tabs',
                    line: 'Underline indicator slides between tabs via layoutId.'
                },
                {
                    slug: 'tab-select',
                    title: 'Tab Select',
                    line: 'Pill-style selector with layout-animated active state.'
                },
                {
                    slug: 'toggle-switch',
                    title: 'Toggle Switch',
                    line: 'Layout-animated thumb that springs between on / off.'
                }
            ]
        },
        {
            key: 'variants',
            label: 'VARIANTS & ORCHESTRATION',
            blurb: 'Named states with parent → child propagation for choreographed cascades.',
            items: [
                {
                    slug: 'variants-basic',
                    title: 'Variants Basic',
                    line: 'Named "rest" / "play" states drive a single motion.div.'
                },
                {
                    slug: 'variants-propagation',
                    title: 'Variants Propagation',
                    line: 'Parent variant cascades to children via per-child delay.'
                }
            ]
        },
        {
            key: 'motion-values',
            label: 'MOTION VALUES & SCROLL',
            blurb: 'Reactive motion values, useTransform mapping, and scroll-linked animation.',
            items: [
                {
                    slug: 'rotate',
                    title: 'Rotate',
                    line: 'Continuous rotation driven by a motion value.'
                },
                {
                    slug: 'scroll-progress',
                    title: 'Scroll Progress',
                    line: 'Page-progress bar from useScroll + useTransform.'
                },
                {
                    slug: 'color-interpolation',
                    title: 'Color Interpolation',
                    line: 'Smooth color tween via useTransform with input/output ranges.'
                },
                {
                    slug: 'conic-gradient',
                    title: 'Conic Gradient',
                    line: 'Pointer-driven conic gradient with reactive motion values.'
                },
                {
                    slug: 'characters-remaining',
                    title: 'Characters Remaining',
                    line: 'Animated character counter pulled from a motion value.'
                }
            ]
        },
        {
            key: 'svg',
            label: 'SVG & PATHS',
            blurb: 'motion.path, keyframe arrays, and animated d attributes for SVG morphs.',
            items: [
                {
                    slug: 'motion-path',
                    title: 'Motion Path',
                    line: 'Animate an element along an arbitrary SVG path.'
                },
                {
                    slug: 'path-morphing',
                    title: 'Path Morphing',
                    line: 'Animate the d attribute between two shapes with flubber.'
                },
                {
                    slug: 'keyframes',
                    title: 'Keyframes',
                    line: 'Array-of-values syntax for multi-stop keyframe transitions.'
                }
            ]
        },
        {
            key: 'hooks',
            label: 'HOOKS',
            blurb: 'useAnimate, useInView, useCycle, useReducedMotion, useTime — adapted for Svelte 5 runes.',
            items: [
                {
                    slug: 'use-animate',
                    title: 'useAnimate',
                    line: 'Imperative scoped animations with a scope action + animate function.'
                },
                {
                    slug: 'use-animation-frame',
                    title: 'useAnimationFrame',
                    line: 'Run a callback every frame with time + delta.'
                },
                {
                    slug: 'use-cycle',
                    title: 'useCycle',
                    line: 'Cycle through a list of animation states imperatively.'
                },
                {
                    slug: 'use-in-view',
                    title: 'useInView',
                    line: 'Reactive boolean for viewport visibility (IntersectionObserver).'
                },
                {
                    slug: 'use-reduced-motion',
                    title: 'useReducedMotion',
                    line: 'Respect prefers-reduced-motion at the component level.'
                },
                {
                    slug: 'use-time',
                    title: 'useTime',
                    line: 'A motion value that ticks continuously — ms since mount.'
                },
                {
                    slug: 'use-time-synced',
                    title: 'useTime (Synced)',
                    line: 'Multiple time-driven animations sharing one motion value.'
                }
            ]
        },
        {
            key: 'ui',
            label: 'UI PATTERNS',
            blurb: 'End-to-end patterns combining motion.<tag>, gestures, and presence.',
            items: [
                {
                    slug: 'animated-button',
                    title: 'Animated Button',
                    line: 'Composed hover + tap + loading-state choreography.'
                },
                {
                    slug: 'html-content',
                    title: 'HTML Content',
                    line: 'Animate arbitrary children inside motion.div containers.'
                },
                {
                    slug: 'style-string',
                    title: 'styleString',
                    line: 'Reactive inline style helper with automatic unit handling.'
                }
            ]
        }
    ]

    const TOTAL = groups.reduce((s, g) => s + g.items.length, 0)
</script>

<div class="brut-wrap flex min-h-svh flex-col">
    <HeaderV2
        config={docsConfig}
        {favicon}
        version={PKG_VERSION}
        nav={[
            { label: 'docs', href: '/docs' },
            { label: 'examples', href: '/examples' },
            { label: 'compare', href: '/compare' }
        ]}
    />

    <main class="brut">
        <!-- ── Coordinate strip ─────────────────────────────────── -->
        <div class="brut-coord" aria-hidden="true">
            {#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
                <div>{String(i + 1).padStart(2, '0')}</div>
            {/each}
        </div>

        <!-- ── FIG-001 · MASTHEAD ───────────────────────────────── -->
        <section class="brut-hero">
            <div class="corner tr">FIG-001 · MASTHEAD</div>
            <aside class="meta">
                <div><span class="k">patterns</span> · <span class="v">{TOTAL}</span></div>
                <div>
                    <span class="k">groups</span> · <span class="v">{groups.length}</span>
                </div>
                <div>
                    <span class="k">library</span> ·
                    <span class="v">@humanspeak/svelte-motion</span>
                </div>
                <hr />
                <div><span class="k">framework</span> · <span class="v accent">svelte 5</span></div>
                <div><span class="k">licence</span> · <span class="v">MIT</span></div>
                <hr />
                <div class="k">// every pattern, one page</div>
            </aside>
            <div class="hero-body">
                <div class="k">// svelte-animations / category index</div>
                <h1>
                    <span>svelte</span>
                    <span class="end">animations</span><span class="end">.</span>
                </h1>
                <p class="sub">
                    <b>The complete catalogue of Svelte animation patterns.</b> Gestures, exit
                    animations, FLIP layout, shared-layout transitions, variants, drag,
                    scroll-linked motion values, SVG paths, and hooks — every pattern built with
                    <b>@humanspeak/svelte-motion</b>, the
                    <b>Framer Motion-compatible animation library</b> for Svelte 5 and SvelteKit. Each
                    card links to a live, editable demo.
                </p>
                <div class="cta-row">
                    <a class="pri" href="/docs">get started ↗</a>
                    <a href="/examples">all examples</a>
                    <a href="/compare/framer-motion">vs framer motion</a>
                    <a href="https://github.com/humanspeak/svelte-motion">github</a>
                </div>
            </div>
            <div class="corner bl">FIG-001</div>
            <div class="corner br">SHEET 01 / {groups.length + 1}</div>
        </section>

        <!-- ── FIG-00n · One section per group ─────────────────── -->
        {#each groups as g, gi (g.key)}
            <section class="brut-section">
                <div class="lede">
                    <div class="k">
                        FIG-{String(gi + 2).padStart(3, '0')} / {g.label}
                    </div>
                    <h2>
                        {g.label.toLowerCase()}<span class="end">.</span>
                    </h2>
                    <p>{g.blurb}</p>
                    <div class="count-pill">
                        {g.items.length}
                        {g.items.length === 1 ? 'pattern' : 'patterns'}
                    </div>
                </div>
                <div class="grid">
                    {#each g.items as ex, i (ex.slug)}
                        <a class="cell" href="/examples/{ex.slug}">
                            <div class="id">
                                № {String(i + 1).padStart(2, '0')} / {String(
                                    g.items.length
                                ).padStart(2, '0')}
                            </div>
                            <div class="corner">↗</div>
                            <h3>{ex.title}</h3>
                            <p>{ex.line}</p>
                            <div class="marker"></div>
                        </a>
                    {/each}
                </div>
            </section>
        {/each}

        <!-- ── Big-type footer ─────────────────────────────────── -->
        <section class="brut-foot">
            <div class="info">
                <div>SET / JETBRAINS MONO + INTER</div>
                <div>HUMANSPEAK · 2026</div>
                <div>MIT LICENCE</div>
                <div class="v">● {PKG_VERSION}</div>
            </div>
            <a class="big" href="/docs">
                try svelte<br /><span>motion</span> →
                <span class="copy-hint">install in 30 seconds</span>
            </a>
            <div class="info right">
                <div>SHEET {groups.length + 1} / {groups.length + 1}</div>
                <div>END OF CATALOGUE</div>
                <a class="v" href="/">↩ HOME</a>
            </div>
        </section>
    </main>

    <FooterV2 version={PKG_VERSION} />
</div>

<style>
    .brut-wrap {
        background: #f8fcfb;
    }
    :global(html.dark) .brut-wrap {
        background: #06090a;
    }

    .brut {
        --brut-bg: #f8fcfb;
        --brut-bg-2: #eef4f1;
        --brut-ink: #0a0a0a;
        --brut-ink-2: #525252;
        --brut-ink-3: #9a9a9a;
        --brut-rule: #d6dedb;
        --brut-rule-2: #bbc4c0;
        --brut-accent: #247768;
        --brut-accent-hover: #1b5a4e;
        --brut-accent-ink: #f8fcfb;
        --brut-accent-soft: rgba(36, 119, 104, 0.1);

        background: var(--brut-bg);
        color: var(--brut-ink);
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 13px;
    }
    :global(html.dark) .brut {
        --brut-bg: #06090a;
        --brut-bg-2: #0d1110;
        --brut-ink: #ededed;
        --brut-ink-2: #9a9a9a;
        --brut-ink-3: #5a5a5a;
        --brut-rule: #1c2422;
        --brut-rule-2: #2a332f;
        --brut-accent: #54dbbc;
        --brut-accent-hover: #7fe9d1;
        --brut-accent-ink: #06090a;
        --brut-accent-soft: rgba(84, 219, 188, 0.14);
    }

    .brut-coord {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        border-bottom: 1px solid var(--brut-rule);
        font-size: 10px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-coord div {
        padding: 6px 8px;
        border-right: 1px solid var(--brut-rule);
    }
    .brut-coord div:last-child {
        border-right: 0;
    }

    .brut-hero {
        padding: 80px 24px 32px;
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 24px;
        border-bottom: 1px solid var(--brut-rule);
        position: relative;
    }
    .brut-hero .meta {
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 11px;
        color: var(--brut-ink-3);
    }
    .brut-hero .meta .k {
        color: var(--brut-ink-3);
    }
    .brut-hero .meta .v {
        color: var(--brut-ink);
    }
    .brut-hero .meta .v.accent {
        color: var(--brut-accent);
    }
    .brut-hero .meta hr {
        border: 0;
        border-top: 1px dashed var(--brut-rule);
        margin: 8px 0;
    }
    .brut-hero .hero-body .k {
        font-size: 11px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-hero h1 {
        margin: 8px 0 0;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: clamp(48px, 9.5vw, 144px);
        line-height: 0.9;
        font-weight: 500;
        letter-spacing: -0.06em;
        text-transform: lowercase;
    }
    .brut-hero h1 span {
        color: var(--brut-ink);
    }
    .brut-hero h1 .end {
        color: var(--brut-accent);
    }
    .brut-hero h1 .end:last-child {
        color: var(--brut-ink-3);
    }
    .brut-hero .sub {
        margin: 28px 0 0;
        max-width: 720px;
        font-size: 17px;
        line-height: 1.5;
        color: var(--brut-ink-2);
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        letter-spacing: -0.01em;
    }
    .brut-hero .sub b {
        color: var(--brut-ink);
        font-weight: 600;
    }
    .brut-hero .cta-row {
        margin-top: 28px;
        display: flex;
        flex-wrap: wrap;
        gap: 0;
        width: fit-content;
        max-width: 100%;
    }
    .brut-hero .cta-row > * {
        padding: 10px 14px;
        border: 1px solid var(--brut-rule);
        background: var(--brut-bg);
        font-size: 13px;
        color: var(--brut-ink);
        text-decoration: none;
        position: relative;
        z-index: 1;
        transition:
            background 0.15s,
            border-color 0.15s;
    }
    .brut-hero .cta-row > * + * {
        margin-left: -1px;
    }
    .brut-hero .cta-row .pri {
        background: var(--brut-accent);
        color: var(--brut-accent-ink);
        font-weight: 600;
        border-color: var(--brut-accent);
    }
    .brut-hero .cta-row .pri:hover {
        background: var(--brut-accent-hover);
        border-color: var(--brut-accent-hover);
    }
    .brut-hero .cta-row a:not(.pri):hover {
        background: var(--brut-bg-2);
        border-color: var(--brut-rule-2);
    }
    .brut-hero .corner {
        position: absolute;
        font-size: 10px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-hero .corner.tr {
        top: 12px;
        right: 24px;
    }
    .brut-hero .corner.bl {
        bottom: 12px;
        left: 24px;
    }
    .brut-hero .corner.br {
        bottom: 12px;
        right: 24px;
    }

    /* ── Group section ────────────────────────────────────────── */
    .brut-section {
        padding: 28px 24px;
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 24px;
        border-bottom: 1px solid var(--brut-rule);
    }
    .brut-section .lede .k {
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-section .lede h2 {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 28px;
        color: var(--brut-accent);
        margin: 12px 0 0;
        letter-spacing: -0.02em;
        text-transform: lowercase;
        font-weight: 500;
    }
    .brut-section .lede h2 .end {
        color: var(--brut-ink-3);
    }
    .brut-section .lede p {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        color: var(--brut-ink-2);
        margin: 12px 0 0;
        font-size: 13px;
        line-height: 1.55;
        max-width: 220px;
    }
    .brut-section .count-pill {
        display: inline-block;
        margin-top: 14px;
        padding: 3px 9px;
        border: 1px solid var(--brut-rule);
        font-size: 10.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--brut-ink-3);
    }
    .brut-section .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        border-left: 1px solid var(--brut-rule);
        border-top: 1px solid var(--brut-rule);
    }
    .brut-section .cell {
        display: block;
        border-right: 1px solid var(--brut-rule);
        border-bottom: 1px solid var(--brut-rule);
        padding: 20px 22px;
        min-height: 180px;
        position: relative;
        color: var(--brut-ink);
        text-decoration: none;
        background: var(--brut-bg);
    }
    .brut-section .cell::after {
        content: '';
        position: absolute;
        inset: 8px;
        border: 1px solid transparent;
        pointer-events: none;
        transition: border-color 0.2s;
    }
    .brut-section .cell:hover::after {
        border-color: var(--brut-accent);
    }
    .brut-section .cell .id {
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-section .cell h3 {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 20px;
        font-weight: 500;
        letter-spacing: -0.02em;
        margin: 22px 0 6px;
        color: var(--brut-ink);
    }
    .brut-section .cell:hover h3 {
        color: var(--brut-accent);
    }
    .brut-section .cell p {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 13px;
        color: var(--brut-ink-2);
        line-height: 1.5;
        margin: 0;
        max-width: 280px;
    }
    .brut-section .cell .corner {
        position: absolute;
        top: 14px;
        right: 16px;
        font-size: 12px;
        color: var(--brut-ink-3);
        transition: color 0.2s;
    }
    .brut-section .cell:hover .corner {
        color: var(--brut-accent);
    }
    .brut-section .cell .marker {
        width: 12px;
        height: 12px;
        border: 1px solid var(--brut-ink-3);
        position: absolute;
        bottom: 14px;
        right: 14px;
    }
    .brut-section .cell:nth-child(3n + 1) .marker {
        background: var(--brut-accent);
        border-color: var(--brut-accent);
    }

    .brut-foot {
        padding: 60px 24px 36px;
        display: grid;
        grid-template-columns: 200px 1fr 200px;
        gap: 24px;
        border-top: 1px solid var(--brut-rule);
        align-items: end;
    }
    .brut-foot .big {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: clamp(40px, 7vw, 96px);
        line-height: 0.9;
        letter-spacing: -0.06em;
        text-transform: lowercase;
        color: var(--brut-ink);
        text-decoration: none;
        display: inline-block;
    }
    .brut-foot .big span {
        color: var(--brut-accent);
    }
    .brut-foot .big .copy-hint {
        display: block;
        margin-top: 16px;
        font-size: 11px;
        letter-spacing: 0.14em;
        color: var(--brut-ink-3);
        text-transform: uppercase;
    }
    .brut-foot .big:hover .copy-hint {
        color: var(--brut-accent);
    }
    .brut-foot .info {
        font-size: 11px;
        color: var(--brut-ink-3);
        letter-spacing: 0.12em;
        line-height: 1.8;
    }
    .brut-foot .info.right {
        text-align: right;
    }
    .brut-foot .info .v,
    .brut-foot .info a.v {
        color: var(--brut-ink);
        text-decoration: none;
        display: block;
        margin-top: 12px;
    }
    .brut-foot .info a.v:hover {
        color: var(--brut-accent);
    }

    @media (max-width: 1024px) {
        .brut-section .grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
    @media (max-width: 720px) {
        .brut-coord {
            display: none;
        }
        .brut-hero,
        .brut-section {
            grid-template-columns: 1fr;
            padding-left: 16px;
            padding-right: 16px;
        }
        .brut-hero {
            padding-top: 56px;
        }
        .brut-section .grid {
            grid-template-columns: 1fr;
        }
        .brut-foot {
            grid-template-columns: 1fr;
            padding: 40px 16px 28px;
        }
        .brut-foot .info.right {
            text-align: left;
        }
    }
</style>
