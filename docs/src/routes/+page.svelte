<script lang="ts">
    import {
        motion,
        AnimatePresence,
        MotionButton,
        MotionSpan,
        type DragInfo
    } from '@humanspeak/svelte-motion'
    import { HeaderV2, FooterV2, getBreadcrumbContext, getSeoContext } from '@humanspeak/docs-kit'
    import { docsConfig } from '$lib/docs-config'
    import favicon from '$lib/assets/logo.svg'
    import githubStats from '$lib/github-stats.json'
    import '@fontsource-variable/inter/index.css'
    import '@fontsource-variable/jetbrains-mono/index.css'
    import type { PageData } from './$types'

    const { data }: { data: PageData } = $props()
    const packageStats = $derived(data.packageStats)

    // ── Breadcrumb + SEO contexts ────────────────────────────────────
    const breadcrumbContext = getBreadcrumbContext()
    if (breadcrumbContext) breadcrumbContext.breadcrumbs = []

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'Svelte Motion · Framer Motion-compatible animation library for Svelte 5'
        seo.description =
            'Svelte Motion is a Framer Motion-compatible animation library for Svelte 5. Declarative motion.<tag> components, AnimatePresence exit animations, gestures (hover/tap/drag/focus/in-view), variants, FLIP layout, shared-layout, spring physics, and scroll-linked motion values.'
        seo.ogTitle = 'Svelte Motion'
        seo.ogTagline =
            'Framer Motion for Svelte 5 — declarative motion components, gestures, variants, layout, spring, and scroll-linked values.'
        seo.ogFeatures = [
            'AnimatePresence',
            'Spring Physics',
            'Gestures & Drag',
            'Layout Animation'
        ]
        seo.ogSlug = 'home'
    }

    // ── Package + library stats ──────────────────────────────────────
    const PKG_NAME = $derived(packageStats.name)
    const PKG_VERSION = $derived(packageStats.version)
    const TARBALL_KB = $derived(
        packageStats.tarballBytes !== null
            ? Math.round(packageStats.tarballBytes / 102.4) / 10
            : null
    )

    // Counts are static facts about the library surface area. They change
    // rarely; cheap to keep them inline rather than re-deriving at runtime.
    const TAG_COUNT = 170 // motion.<tag> proxies (HTML + SVG)
    const HOOK_COUNT = 16 // useAnimate, useScroll, useSpring, useTransform, ...
    const GESTURE_COUNT = 5 // hover, tap, drag, focus, in-view

    interface StatItem {
        k: string
        v: string
        sup?: string
        n: string
        ac?: boolean
    }
    const stats: StatItem[] = $derived([
        { k: 'motion tags', v: String(TAG_COUNT), n: 'HTML + SVG proxies', ac: true },
        { k: 'hooks', v: String(HOOK_COUNT), n: 'useSpring / useScroll / …' },
        {
            k: 'gestures',
            v: String(GESTURE_COUNT),
            n: 'hover · tap · drag · focus · in-view',
            ac: true
        },
        {
            k: 'tarball',
            v: TARBALL_KB !== null ? String(TARBALL_KB) : '—',
            sup: TARBALL_KB !== null ? 'kB' : undefined,
            n: 'packed (npm gz)'
        },
        { k: 'runtime deps', v: '2', n: 'motion · motion-dom' },
        { k: 'licence', v: 'MIT', n: 'on GitHub' }
    ])

    const features = [
        {
            title: 'Drop-in motion.<tag>',
            body: `${TAG_COUNT} proxy components covering every HTML and SVG element. Add initial, animate, and transition props to any tag.`
        },
        {
            title: 'AnimatePresence',
            body: 'Mount and unmount with exit animations. mode="sync", "wait", or "popLayout" — same semantics as Framer Motion.'
        },
        {
            title: 'Gestures & Drag',
            body: 'whileHover, whileTap, whileFocus, whileInView, plus a full drag API with constraints, momentum, elastic, snap-to-origin.'
        },
        {
            title: 'Variants',
            body: 'Named animation states that propagate from parent to children. Orchestrate stagger and choreography without managing state by hand.'
        },
        {
            title: 'Layout & Shared Layout',
            body: 'FLIP-based layout animation with the layout prop. Animate between elements across the DOM with layoutId.'
        },
        {
            title: 'Spring & Scroll-linked',
            body: 'useSpring for physics-based motion values. useScroll + useTransform for scroll-linked animations. SSR-safe by default.'
        }
    ]

    // ── Drag demo (FIG-002) ──────────────────────────────────────────
    // Live drag with a visible dragConstraints frame (400 × 240 box
    // around the card origin). We read x / y from the onDrag callback's
    // info.offset (the lib writes transform: translate(...) directly to
    // the element rather than exposing internal motion values), and
    // derive rotation in $state, applied via the CSS `rotate` property
    // (independent of the translate transform — browsers composite them).
    let dragXRead = $state(0)
    let dragYRead = $state(0)
    let dragIsActive = $state(false)
    let dragPeakX = $state(0)
    let dragPeakY = $state(0)
    const dragRotRead = $derived(
        Math.round(Math.max(-12, Math.min(12, (dragXRead / 200) * 12)) * 10) / 10
    )

    const onCardDrag = (_event: PointerEvent, info: DragInfo) => {
        const x = info.offset.x
        const y = info.offset.y
        dragXRead = Math.round(x)
        dragYRead = Math.round(y)
        if (Math.abs(x) > Math.abs(dragPeakX)) dragPeakX = Math.round(x)
        if (Math.abs(y) > Math.abs(dragPeakY)) dragPeakY = Math.round(y)
    }

    const clearDragPeaks = () => {
        dragPeakX = 0
        dragPeakY = 0
    }

    // ── Variants orchestration demo (FIG-004) ────────────────────────
    // svelte-motion propagates the parent's variant state to children
    // (children with `variants={...}` and no explicit `animate` follow
    // the parent), but the parent's transition.staggerChildren orchestrator
    // is not honoured — so we drive the cascade with a per-child
    // `transition.delay = i * staggerMs / 1000`, same pattern the lib's
    // own VariantsPropagationExample uses.
    type VariantState = 'rest' | 'play'
    let variantState = $state<VariantState>('rest')
    let staggerMs = $state(60)
    let directionForward = $state(true)

    const playVariants = () => {
        variantState = variantState === 'rest' ? 'play' : 'rest'
    }
    const resetVariants = () => {
        variantState = 'rest'
    }
    const toggleDirection = () => {
        directionForward = !directionForward
    }

    const variantChildren = Array.from({ length: 12 }, (_, i) => i)
    const CHILD_COUNT = variantChildren.length
    const childDelay = (i: number) =>
        ((directionForward ? i : CHILD_COUNT - 1 - i) * staggerMs) / 1000

    // We drive the cascade with transform only — svelte-motion does not
    // reliably apply variant inline styles before the first state change,
    // so opacity would show as 1 at mount even when 'rest' has opacity 0.
    // Transforms read off the CSS baseline (matrix(none)) so the cascade
    // reads correctly on every transition.
    const childVariants = {
        rest: { y: 0, scale: 1, rotate: 0 },
        play: { y: -22, scale: 1.12, rotate: -3 }
    }

    // ── Comparison matrix ────────────────────────────────────────────
    type Cell = boolean | string
    interface CompareRow {
        slug: string | null
        name: string
        framework: string
        declarative: Cell
        exit: Cell
        gestures: Cell
        layout: Cell
        spring: Cell
    }
    const compareRows: CompareRow[] = [
        {
            slug: null,
            name: '@humanspeak/svelte-motion',
            framework: 'Svelte 5',
            declarative: true,
            exit: true,
            gestures: true,
            layout: true,
            spring: true
        },
        {
            slug: 'framer-motion',
            name: 'framer-motion',
            framework: 'React only',
            declarative: true,
            exit: true,
            gestures: true,
            layout: true,
            spring: true
        },
        {
            slug: 'motion-one',
            name: 'motion / Motion One',
            framework: 'agnostic',
            declarative: false,
            exit: false,
            gestures: 'partial',
            layout: false,
            spring: true
        },
        {
            slug: 'gsap',
            name: 'GSAP',
            framework: 'agnostic',
            declarative: false,
            exit: false,
            gestures: 'plugins',
            layout: 'Flip plugin',
            spring: 'plugins'
        },
        {
            slug: null,
            name: 'svelte/transition',
            framework: 'Svelte (built-in)',
            declarative: 'partial',
            exit: true,
            gestures: false,
            layout: false,
            spring: 'partial'
        },
        {
            slug: null,
            name: 'svelte/animate',
            framework: 'Svelte (built-in)',
            declarative: 'partial',
            exit: false,
            gestures: false,
            layout: 'FLIP only',
            spring: false
        }
    ]

    const formatCell = (v: Cell): { text: string; cls: string } => {
        if (v === true) return { text: 'yes', cls: 'y' }
        if (v === false) return { text: 'no', cls: 'n' }
        return { text: String(v), cls: '' }
    }

    // ── Featured examples (homepage tiles → /examples/<slug>) ────────
    const featuredExamples = [
        {
            slug: 'shared-layout-animation',
            title: 'Shared Layout Animation',
            body: 'Animate between two elements anywhere in the DOM with a shared layoutId. The FLIP engine interpolates the transition automatically.'
        },
        {
            slug: 'hover-and-tap',
            title: 'Hover & Tap',
            body: 'whileHover and whileTap give you fluent gesture states. Combine with spring transitions for natural micro-interactions.'
        },
        {
            slug: 'variants-basic',
            title: 'Variants',
            body: 'Define named animation states once and orchestrate them across a tree. Stagger, propagate, and cascade without managing each child.'
        },
        {
            slug: 'scroll-progress',
            title: 'Scroll Progress',
            body: 'useScroll gives you a motion value for page progress. Pipe it through useTransform to drive any property.'
        },
        {
            slug: 'path-morphing',
            title: 'Path Morphing',
            body: 'Animate SVG path d attributes with motion.path. Perfect for icon transitions and shape-shifting illustrations.'
        },
        {
            slug: 'animate-presence',
            title: 'AnimatePresence',
            body: 'Wrap conditionally-rendered components and they exit gracefully on unmount. mode="wait" / "sync" / "popLayout" supported.'
        }
    ]

    // ── Copy install command ─────────────────────────────────────────
    const installCmd = $derived(`npm i ${PKG_NAME}`)
    let copied = $state(false)
    const copyInstall = async () => {
        if (typeof navigator === 'undefined') return
        try {
            await navigator.clipboard.writeText(installCmd)
            copied = true
            setTimeout(() => (copied = false), 1500)
        } catch {
            /* clipboard blocked — fail quiet */
        }
    }

    // ── Schema.org SoftwareApplication ────────────────────────────────
    // Note: aggregateRating was removed per SEO.md P0 — GitHub stars
    // aren't ratings, and Google can apply a structured-data manual
    // action when ratingCount isn't backed by visible reviews.
    const softwareJsonLd = `<${'script'} type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Svelte Motion',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        url: 'https://motion.svelte.page',
        description:
            'Framer Motion for Svelte 5. Declarative motion.<tag> components with AnimatePresence exit animations, gestures (hover, tap, drag, focus, in-view), variants, FLIP layout animations, shared-layout transitions, spring physics, and scroll-linked motion values.',
        codeRepository: 'https://github.com/humanspeak/svelte-motion',
        programmingLanguage: ['TypeScript', 'Svelte'],
        keywords: [
            'animation',
            'Framer Motion',
            'Svelte 5',
            'gestures',
            'spring physics',
            'layout animation',
            'AnimatePresence',
            'variants',
            'drag'
        ],
        author: {
            '@type': 'Organization',
            name: 'Humanspeak',
            url: 'https://humanspeak.com',
            sameAs: [
                'https://github.com/humanspeak',
                'https://github.com/humanspeak/svelte-motion',
                'https://www.npmjs.com/package/@humanspeak/svelte-motion'
            ]
        },
        downloadUrl: 'https://www.npmjs.com/package/@humanspeak/svelte-motion',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD'
        },
        license: 'https://opensource.org/licenses/MIT',
        interactionStatistic: {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/LikeAction',
            userInteractionCount: githubStats.stars,
            name: 'GitHub stars'
        }
    })}</${'script'}>`
</script>

<svelte:head>
    <title>Svelte Motion · Framer Motion-compatible animation library for Svelte 5</title>
    <meta
        name="description"
        content="Svelte Motion is a Framer Motion-compatible animation library for Svelte 5. Declarative motion.<tag> components, AnimatePresence exit animations, gestures, variants, FLIP layout, shared-layout, spring physics, and scroll-linked motion values."
    />
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- static JSON-LD, no user input -->
    {@html softwareJsonLd}
</svelte:head>

<div class="brut-wrap flex min-h-svh flex-col">
    <HeaderV2
        config={docsConfig}
        {favicon}
        version={PKG_VERSION}
        nav={[
            { label: 'docs', href: '/docs' },
            { label: 'examples', href: '/examples' }
        ]}
    />

    <main class="brut">
        <!-- ── Coordinate strip ───────────────────────────────────────── -->
        <div class="brut-coord" aria-hidden="true">
            {#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
                <div>{String(i + 1).padStart(2, '0')}</div>
            {/each}
        </div>

        <!-- ── FIG-001 · MASTHEAD ─────────────────────────────────── -->
        <section class="brut-hero">
            <div class="corner tr">FIG-001 · MASTHEAD</div>
            <aside class="meta">
                <div><span class="k">pkg</span> · <span class="v">{PKG_NAME}</span></div>
                <div><span class="k">version</span> · <span class="v">{PKG_VERSION}</span></div>
                <div>
                    <span class="k">tarball</span> ·
                    <span class="v">{TARBALL_KB !== null ? `${TARBALL_KB} kB gz` : '—'}</span>
                </div>
                <div><span class="k">deps</span> · <span class="v">2</span></div>
                <div><span class="k">licence</span> · <span class="v">MIT</span></div>
                <hr />
                <div><span class="k">motion tags</span> · <span class="v">{TAG_COUNT}</span></div>
                <div><span class="k">hooks</span> · <span class="v">{HOOK_COUNT}</span></div>
                <div>
                    <span class="k">api parity</span> ·
                    <span class="v accent">framer-motion</span>
                </div>
                <hr />
                <div class="k">// scroll for full spec</div>
            </aside>
            <div class="hero-body">
                <h1>
                    <span>svelte</span><span class="slash">/</span><span>motion</span><span
                        class="end">.</span
                    >
                </h1>
                <p class="sub">
                    <b>Framer Motion for Svelte 5.</b> Declarative <code>motion.&lt;tag&gt;</code>
                    components with AnimatePresence exit animations, gestures (hover, tap, drag, focus,
                    in-view), variants, FLIP layout animations, shared-layout transitions, spring physics,
                    and scroll-linked motion values. The drop-in <b>Framer Motion alternative</b> for
                    Svelte and SvelteKit.
                </p>
                <div class="cta-row">
                    <a class="pri" href="/docs">get started ↗</a>
                    <a href="/docs/animate-presence">api reference</a>
                    <a href="/examples">examples</a>
                    <a href="https://github.com/humanspeak/svelte-motion">github</a>
                    <MotionButton
                        class="inst"
                        type="button"
                        onclick={copyInstall}
                        aria-label="Copy install command"
                        whileTap={{ scale: 0.97 }}
                        whileHover={{ scale: 1.01 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                    >
                        <span class="inst-prompt">$</span>
                        <span class="inst-cmd">npm i <span class="pkg">{PKG_NAME}</span></span>
                        <span class="inst-copy {copied ? 'is-copied' : ''}">
                            <AnimatePresence initial={false}>
                                <MotionSpan
                                    key={copied ? 'copied' : 'idle'}
                                    class="inst-copy-label"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.18, ease: 'easeOut' }}
                                >
                                    {copied ? '✓ copied' : 'copy'}
                                </MotionSpan>
                            </AnimatePresence>
                        </span>
                    </MotionButton>
                </div>
            </div>
            <div class="corner bl">FIG-001</div>
            <div class="corner br">SHEET 01 / 06</div>
        </section>

        <!-- ── Stats row ───────────────────────────────────────────── -->
        <section class="brut-stats">
            {#each stats as s, i (s.k)}
                <div class="s {s.ac ? 'ac' : ''}" data-idx="/0{i + 1}">
                    <div class="k">{s.k}</div>
                    <div class="v">
                        <span class="v-num">{s.v}</span>{#if s.sup}<span class="v-unit"
                                >{s.sup}</span
                            >{/if}
                    </div>
                    <div class="note">{s.n}</div>
                </div>
            {/each}
        </section>

        <!-- ── FIG-002 · DRAG DEMO ─────────────────────────────────── -->
        <section class="brut-demo">
            <div class="lede">
                <div class="k">FIG-002 / DRAG</div>
                <h2>drag with <span>spring physics</span>.</h2>
                <p>
                    Drop drag onto any motion tag and read its motion values live. useTransform maps
                    horizontal velocity to rotation — no manual math.
                </p>
            </div>
            <div class="panel">
                <div class="bar">
                    <span
                        ><span class="lbl">file</span> ·
                        <span class="v">drag.svelte</span></span
                    >
                    <span><span class="lbl">x</span> <span class="v">{dragXRead}px</span></span>
                    <span><span class="lbl">y</span> <span class="v">{dragYRead}px</span></span>
                    <span
                        ><span class="lbl">rotate</span> <span class="v">{dragRotRead}°</span></span
                    >
                    <span class="live">
                        {#if dragIsActive}● ACTIVE{:else}○ IDLE{/if}
                    </span>
                    <button class="ctrl" type="button" onclick={clearDragPeaks}
                        >↻ clear peaks</button
                    >
                </div>
                <div class="stage">
                    <div class="hint">drag me</div>
                    <!-- Visible dragConstraints frame: the card's origin (its
                         centre) is held within this 400 × 240 box. -->
                    <div class="constraints-box" aria-hidden="true">
                        <span class="cb-tl">−200, −120</span>
                        <span class="cb-tr">+200, −120</span>
                        <span class="cb-bl">−200, +120</span>
                        <span class="cb-br">+200, +120</span>
                        <span class="cb-label">dragConstraints · 400 × 240</span>
                    </div>
                    <motion.div
                        class="drag-card"
                        drag
                        dragConstraints={{ left: -200, right: 200, top: -120, bottom: 120 }}
                        dragElastic={0.18}
                        dragTransition={{ bounceStiffness: 360, bounceDamping: 24 }}
                        whileHover={{ scale: 1.02 }}
                        whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
                        onDragStart={() => (dragIsActive = true)}
                        onDrag={onCardDrag}
                        onDragEnd={() => (dragIsActive = false)}
                        style="rotate: {dragRotRead}deg"
                    >
                        <span class="dc-label">motion.div</span>
                        <ul class="dc-props">
                            <li>drag</li>
                            <li>dragConstraints</li>
                            <li>dragElastic</li>
                        </ul>
                    </motion.div>
                </div>
                <div class="footer">
                    <div>peak x · <span class="v">{dragPeakX}px</span></div>
                    <div>peak y · <span class="v">{dragPeakY}px</span></div>
                    <div>spring · <span class="v">stiff 360 / damp 24</span></div>
                    <div>elastic · <span class="v">0.18</span></div>
                    <div>
                        status · <span class="v accent">{dragIsActive ? 'dragging' : 'idle'}</span>
                    </div>
                </div>
            </div>
        </section>

        <!-- ── FIG-003 · CAPABILITIES ──────────────────────────────── -->
        <section class="brut-feat">
            <div class="lede">
                <div class="k">FIG-003 / CAPABILITIES</div>
                <h2>why <span>svelte motion</span>.</h2>
                <p>The most complete motion library for Svelte 5 — modelled on Framer Motion.</p>
            </div>
            <div class="grid">
                {#each features as f, i (f.title)}
                    <div class="cell">
                        <div class="id">
                            № {String(i + 1).padStart(2, '0')} / {String(features.length).padStart(
                                2,
                                '0'
                            )}
                        </div>
                        <div class="corner">▢</div>
                        <h3>{f.title}</h3>
                        <p>{f.body}</p>
                        <div class="marker"></div>
                    </div>
                {/each}
            </div>
        </section>

        <!-- ── FIG-004 · VARIANTS LAB ──────────────────────────────── -->
        <section class="brut-lab" id="variants">
            <div class="lede">
                <div class="k">FIG-004 / VARIANTS</div>
                <h2>orchestrate <span>variants</span> with stagger.</h2>
                <p>One parent state cascades to N children. Adjust stagger and direction live.</p>
            </div>
            <div class="panel">
                <div class="head">
                    <span class="tab on">variants.svelte</span>
                    <span class="grow"></span>
                    <button class="ctrl" type="button" onclick={resetVariants}>⟲ reset</button>
                    <button class="ctrl primary" type="button" onclick={playVariants}>
                        {variantState === 'rest' ? '▶ play' : '■ stop'}
                    </button>
                </div>
                <div class="strip">
                    <label class="strip-lbl">
                        <span class="strip-k">stagger</span>
                        <input
                            type="range"
                            min="0"
                            max="200"
                            step="10"
                            bind:value={staggerMs}
                            aria-label="Stagger milliseconds"
                        />
                        <span class="strip-v">{staggerMs}ms</span>
                    </label>
                    <button
                        class="strip-toggle"
                        type="button"
                        onclick={toggleDirection}
                        aria-label="Toggle stagger direction"
                    >
                        <span class="strip-k">direction</span>
                        <span class="strip-v">{directionForward ? '01 → 12' : '12 → 01'}</span>
                    </button>
                    <span class="strip-spacer"></span>
                    <span class="strip-status">
                        <span class="strip-k">state</span>
                        <span class="strip-v accent">{variantState}</span>
                    </span>
                </div>
                <div class="body">
                    <div class="vgrid">
                        {#each variantChildren as i (i)}
                            <motion.div
                                class="vcell {variantState === 'play' ? 'lifted' : ''}"
                                variants={childVariants}
                                initial="rest"
                                animate={variantState}
                                transition={{
                                    type: 'spring',
                                    stiffness: 360,
                                    damping: 22,
                                    delay: childDelay(i)
                                }}
                            >
                                <span class="vnum">{String(i + 1).padStart(2, '0')}</span>
                            </motion.div>
                        {/each}
                    </div>
                </div>
            </div>
        </section>

        <!-- ── FIG-005 · COMPARISON MATRIX ─────────────────────────── -->
        <section class="brut-comp">
            <div class="k">FIG-005 / COMPARISON MATRIX</div>
            <h2>how we <span>compare</span>.</h2>
            <p class="lede-p">
                Honest, side-by-side comparison with every major motion / animation library you'd
                consider for Svelte.
            </p>
            <div class="comp-scroll">
                <table>
                    <thead>
                        <tr>
                            <th>library</th>
                            <th>framework</th>
                            <th>declarative</th>
                            <th>exit anim</th>
                            <th>gestures</th>
                            <th>layout</th>
                            <th>spring</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each compareRows as row, i (row.name)}
                            {@const decl = formatCell(row.declarative)}
                            {@const exit = formatCell(row.exit)}
                            {@const gest = formatCell(row.gestures)}
                            {@const lay = formatCell(row.layout)}
                            {@const spr = formatCell(row.spring)}
                            <tr class={i === 0 ? 'us-row' : ''}>
                                <td class={i === 0 ? 'us' : ''}>{row.name}{i === 0 ? ' ●' : ''}</td>
                                <td class={i === 0 ? 'us' : ''}>{row.framework}</td>
                                <td class={decl.cls}>{decl.text}</td>
                                <td class={exit.cls}>{exit.text}</td>
                                <td class={gest.cls}>{gest.text}</td>
                                <td class={lay.cls}>{lay.text}</td>
                                <td class={spr.cls}>{spr.text}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </section>

        <!-- ── FIG-006 · EXAMPLES ──────────────────────────────────── -->
        <section class="brut-ex">
            <div class="lede">
                <div class="k">FIG-006 / EXAMPLES</div>
                <h2>explore <span>interactive examples</span>.</h2>
                <p>
                    AnimatePresence, shared layout, hover &amp; tap, variants, scroll-progress, path
                    morphing — every concept has a live, editable demo.
                </p>
            </div>
            <div>
                <div class="grid">
                    {#each featuredExamples as ex, i (ex.slug)}
                        <a class="cell" href="/examples/{ex.slug}">
                            <div class="id">
                                № {String(i + 1).padStart(2, '0')} / {String(
                                    featuredExamples.length
                                ).padStart(2, '0')}
                            </div>
                            <div class="corner">↗</div>
                            <h3>{ex.title}</h3>
                            <p>{ex.body}</p>
                            <div class="marker"></div>
                        </a>
                    {/each}
                </div>
                <a class="ex-all" href="/examples">view all examples →</a>
            </div>
        </section>

        <!-- ── Big-type footer ─────────────────────────────────────── -->
        <section class="brut-foot">
            <div class="info">
                <div>SET / JETBRAINS MONO + INTER</div>
                <div>HUMANSPEAK · 2026</div>
                <div>MIT LICENCE</div>
                <div class="v">● {PKG_VERSION}</div>
            </div>
            <MotionButton
                class="big"
                type="button"
                onclick={copyInstall}
                aria-label="Copy install command"
                whileTap={{ scale: 0.985 }}
                whileHover={{ scale: 1.005 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            >
                npm&nbsp;i&nbsp;<span>@humanspeak/</span><br />svelte-motion
                <span class="copy-hint">
                    <AnimatePresence initial={false}>
                        <MotionSpan
                            key={copied ? 'copied' : 'idle'}
                            class="copy-hint-label"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                        >
                            {copied ? '✓ copied to clipboard' : 'click to copy'}
                        </MotionSpan>
                    </AnimatePresence>
                </span>
            </MotionButton>
            <div class="info right">
                <div>SHEET 06 / 06</div>
                <div>END OF DOCUMENT</div>
                <a class="v" href="#top">↩ TO TOP</a>
            </div>
        </section>
    </main>

    <FooterV2 version={PKG_VERSION} />
</div>

<style>
    /* ── Brutalist Mono palette + tokens ──────────────────────────── */
    .brut-wrap {
        background: var(--brut-bg);
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
        --brut-accent-ink: #f8fcfb;
        --brut-accent-soft: rgba(36, 119, 104, 0.1);

        background: var(--brut-bg);
        color: var(--brut-ink);
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 13px;
        letter-spacing: 0;
    }
    :global(html.dark) .brut,
    :global(html.dark) .brut-wrap {
        --brut-bg: #06090a;
        --brut-bg-2: #0d1110;
        --brut-ink: #ededed;
        --brut-ink-2: #9a9a9a;
        --brut-ink-3: #5a5a5a;
        --brut-rule: #1c2422;
        --brut-rule-2: #2a332f;
        --brut-accent: #54dbbc;
        --brut-accent-ink: #06090a;
        --brut-accent-soft: rgba(84, 219, 188, 0.14);
    }
    :global(html.dark) .brut-wrap {
        background: var(--brut-bg);
    }

    /* ── Coordinate strip ─────────────────────────────────────────── */
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

    /* ── Hero ─────────────────────────────────────────────────────── */
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
        margin: 0;
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
    .brut-hero h1 {
        margin: 0;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: clamp(56px, 11vw, 152px);
        line-height: 0.88;
        font-weight: 500;
        letter-spacing: -0.06em;
        text-transform: lowercase;
    }
    .brut-hero h1 .slash {
        color: var(--brut-accent);
    }
    .brut-hero h1 .end {
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
    .brut-hero .sub code {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        background: var(--brut-bg-2);
        border: 1px solid var(--brut-rule);
        padding: 0 5px;
        font-size: 14.5px;
        color: var(--brut-ink);
    }
    .brut-hero .cta-row {
        margin-top: 28px;
        display: flex;
        flex-wrap: wrap;
        gap: 0;
        align-items: stretch;
        width: fit-content;
        max-width: 100%;
    }
    .brut-hero .cta-row > * {
        padding: 10px 14px;
        border: 1px solid var(--brut-rule);
        background: var(--brut-bg);
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--brut-ink);
        cursor: pointer;
        font-family: inherit;
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
    .brut-hero .cta-row > *:hover {
        z-index: 2;
    }
    .brut-hero .cta-row .pri {
        background: var(--brut-accent);
        color: var(--brut-accent-ink);
        font-weight: 600;
        border-color: var(--brut-accent);
    }
    .brut-hero .cta-row .pri:hover {
        filter: brightness(0.95);
    }
    .brut-hero .cta-row a:hover,
    .brut-hero .cta-row :global(.inst:hover) {
        background: var(--brut-bg-2);
        border-color: var(--brut-rule-2);
    }
    .brut-hero .cta-row :global(.inst) {
        padding: 10px 18px;
        border: 1px solid var(--brut-rule);
        background: var(--brut-bg-2);
        color: var(--brut-ink-2);
        font-family: inherit;
        font-size: 13px;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        position: relative;
        z-index: 1;
        margin-left: -1px;
        transition:
            background 0.15s,
            border-color 0.15s;
    }
    .brut-hero .cta-row :global(.inst:hover) {
        z-index: 2;
    }
    .brut-hero .cta-row :global(.inst .inst-prompt) {
        color: var(--brut-ink-3);
    }
    .brut-hero .cta-row :global(.inst .inst-cmd) {
        color: var(--brut-ink-2);
    }
    .brut-hero .cta-row :global(.inst .inst-cmd .pkg) {
        color: var(--brut-ink);
    }
    .brut-hero .cta-row :global(.inst .inst-copy) {
        margin-left: 4px;
        padding: 2px 8px;
        font-size: 10.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--brut-accent);
        border: 1px solid var(--brut-rule);
        display: inline-grid;
        align-items: center;
        justify-items: center;
        min-width: 84px;
        height: 20px;
        overflow: hidden;
        transition:
            border-color 0.2s,
            background 0.2s;
    }
    .brut-hero .cta-row :global(.inst .inst-copy.is-copied) {
        border-color: var(--brut-accent);
        background: var(--brut-accent-soft);
    }
    .brut-hero .cta-row :global(.inst .inst-copy-label) {
        grid-area: 1 / 1;
        display: inline-block;
        white-space: nowrap;
        will-change: transform, opacity;
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

    /* ── Stats row ────────────────────────────────────────────────── */
    .brut-stats {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        border-bottom: 1px solid var(--brut-rule);
    }
    .brut-stats .s {
        padding: 28px 24px;
        border-right: 1px solid var(--brut-rule);
        position: relative;
        min-height: 160px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .brut-stats .s:last-child {
        border-right: 0;
    }
    .brut-stats .s .k {
        font-size: 10.5px;
        letter-spacing: 0.14em;
        color: var(--brut-ink-3);
    }
    .brut-stats .s .v {
        font-size: 64px;
        line-height: 1;
        font-weight: 500;
        letter-spacing: -0.04em;
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
        white-space: nowrap;
    }
    .brut-stats .s .v-num {
        line-height: 1;
    }
    .brut-stats .s .v-unit {
        font-size: 22px;
        letter-spacing: 0;
        font-weight: 500;
        color: inherit;
        line-height: 1;
    }
    .brut-stats .s .note {
        font-size: 11px;
        color: var(--brut-ink-2);
    }
    .brut-stats .s.ac .v {
        color: var(--brut-accent);
    }
    .brut-stats .s::after {
        content: attr(data-idx);
        position: absolute;
        top: 12px;
        right: 14px;
        font-size: 10px;
        color: var(--brut-ink-3);
    }

    /* ── Section lede (shared by demo / feat / lab) ───────────────── */
    .brut-demo .lede,
    .brut-feat .lede,
    .brut-lab .lede {
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-demo .lede h2,
    .brut-feat .lede h2,
    .brut-lab .lede h2 {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 28px;
        color: var(--brut-ink);
        margin: 12px 0 0;
        letter-spacing: -0.02em;
        text-transform: lowercase;
        font-weight: 500;
    }
    .brut-demo .lede h2 span,
    .brut-feat .lede h2 span,
    .brut-lab .lede h2 span {
        color: var(--brut-accent);
    }
    .brut-demo .lede p,
    .brut-lab .lede p {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        color: var(--brut-ink-2);
        margin: 12px 0 0;
        font-size: 13px;
        line-height: 1.55;
        letter-spacing: 0;
    }

    /* ── Drag demo (FIG-002) ──────────────────────────────────────── */
    .brut-demo {
        padding: 28px 24px;
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 24px;
        border-bottom: 1px solid var(--brut-rule);
    }
    .brut-demo .panel {
        border: 1px solid var(--brut-rule);
        background: var(--brut-bg);
    }
    .brut-demo .panel .bar {
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 8px 14px;
        border-bottom: 1px solid var(--brut-rule);
        font-size: 11px;
        color: var(--brut-ink-2);
        background: var(--brut-bg-2);
        flex-wrap: wrap;
    }
    .brut-demo .panel .bar .lbl {
        color: var(--brut-ink-3);
    }
    .brut-demo .panel .bar .v {
        color: var(--brut-ink);
    }
    .brut-demo .panel .bar .live {
        margin-left: auto;
        color: var(--brut-accent);
    }
    .brut-demo .panel .ctrl {
        background: transparent;
        border: 1px solid var(--brut-rule);
        padding: 4px 10px;
        font-family: inherit;
        font-size: 11px;
        color: var(--brut-ink-2);
        cursor: pointer;
    }
    .brut-demo .panel .ctrl:hover {
        background: var(--brut-bg);
        color: var(--brut-ink);
    }
    .brut-demo .panel .stage {
        position: relative;
        height: 420px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background-image:
            linear-gradient(var(--brut-rule) 1px, transparent 1px),
            linear-gradient(90deg, var(--brut-rule) 1px, transparent 1px);
        background-size: 32px 32px;
        background-position: center center;
    }
    .brut-demo .panel .stage .hint {
        position: absolute;
        bottom: 12px;
        left: 14px;
        font-size: 10.5px;
        letter-spacing: 0.14em;
        color: var(--brut-ink-3);
    }
    /* Visible constraint frame — same dimensions as the dragConstraints
       passed to motion.div (400 × 240 box centred on the card origin). */
    .brut-demo .panel .stage .constraints-box {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 400px;
        height: 240px;
        transform: translate(-50%, -50%);
        border: 1px dashed var(--brut-rule-2);
        pointer-events: none;
    }
    .brut-demo .panel .stage .constraints-box span {
        position: absolute;
        font-size: 9.5px;
        letter-spacing: 0.12em;
        color: var(--brut-ink-3);
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        white-space: nowrap;
    }
    .brut-demo .panel .stage .constraints-box .cb-tl {
        top: -16px;
        left: -2px;
    }
    .brut-demo .panel .stage .constraints-box .cb-tr {
        top: -16px;
        right: -2px;
    }
    .brut-demo .panel .stage .constraints-box .cb-bl {
        bottom: -16px;
        left: -2px;
    }
    .brut-demo .panel .stage .constraints-box .cb-br {
        bottom: -16px;
        right: -2px;
    }
    .brut-demo .panel .stage .constraints-box .cb-label {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 10px;
        color: var(--brut-ink-3);
        opacity: 0.55;
    }
    .brut-demo .panel :global(.drag-card) {
        width: 280px;
        height: 132px;
        padding: 14px 18px;
        background: var(--brut-bg);
        border: 1px solid var(--brut-accent);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        cursor: grab;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        user-select: none;
        will-change: transform;
        box-sizing: border-box;
    }
    :global(html.dark) .brut-demo .panel :global(.drag-card) {
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    .brut-demo .panel :global(.drag-card .dc-label) {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 17px;
        color: var(--brut-ink);
        letter-spacing: -0.02em;
        line-height: 1;
    }
    /* Prop chips — small bordered cells for each drag-related prop. Sits
       below the title and reads as a structured spec rather than a
       bullet-separated string that overflows the card. */
    .brut-demo .panel :global(.drag-card .dc-props) {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 4px;
        max-width: 100%;
    }
    .brut-demo .panel :global(.drag-card .dc-props li) {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 9.5px;
        line-height: 1;
        letter-spacing: 0.04em;
        padding: 4px 6px;
        border: 1px solid var(--brut-rule);
        color: var(--brut-ink-2);
        background: var(--brut-bg-2);
        white-space: nowrap;
    }
    .brut-demo .panel .footer {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        border-top: 1px solid var(--brut-rule);
        font-size: 11px;
        color: var(--brut-ink-2);
    }
    .brut-demo .panel .footer > div {
        padding: 8px 14px;
        border-right: 1px solid var(--brut-rule);
    }
    .brut-demo .panel .footer > div:last-child {
        border-right: 0;
    }
    .brut-demo .panel .footer .v {
        color: var(--brut-ink);
    }
    .brut-demo .panel .footer .v.accent {
        color: var(--brut-accent);
    }

    /* ── Features grid ────────────────────────────────────────────── */
    .brut-feat {
        padding: 28px 24px;
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 24px;
        border-bottom: 1px solid var(--brut-rule);
    }
    .brut-feat .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0;
        border-left: 1px solid var(--brut-rule);
        border-top: 1px solid var(--brut-rule);
    }
    .brut-feat .cell {
        border-right: 1px solid var(--brut-rule);
        border-bottom: 1px solid var(--brut-rule);
        padding: 20px 22px;
        min-height: 200px;
        position: relative;
    }
    .brut-feat .cell::after {
        content: '';
        position: absolute;
        inset: 8px;
        border: 1px solid transparent;
        pointer-events: none;
        transition: border-color 0.2s;
    }
    .brut-feat .cell:hover::after {
        border-color: var(--brut-accent);
    }
    .brut-feat .cell .id {
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-feat .cell h3 {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 22px;
        font-weight: 500;
        letter-spacing: -0.02em;
        margin: 30px 0 8px;
        color: var(--brut-ink);
    }
    .brut-feat .cell p {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 13.5px;
        color: var(--brut-ink-2);
        line-height: 1.55;
        margin: 0;
        max-width: 320px;
    }
    .brut-feat .cell .corner {
        position: absolute;
        top: 14px;
        right: 16px;
        font-size: 10.5px;
        color: var(--brut-ink-3);
    }
    .brut-feat .cell .marker {
        width: 14px;
        height: 14px;
        border: 1px solid var(--brut-ink-3);
        position: absolute;
        bottom: 16px;
        right: 16px;
    }
    .brut-feat .cell:nth-child(3n + 1) .marker {
        background: var(--brut-accent);
        border-color: var(--brut-accent);
    }

    /* ── Variants lab (FIG-004) ───────────────────────────────────── */
    .brut-lab {
        padding: 28px 24px;
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 24px;
        border-bottom: 1px solid var(--brut-rule);
        scroll-margin-top: 80px;
    }
    .brut-lab .panel {
        border: 1px solid var(--brut-rule);
        background: var(--brut-bg);
    }
    .brut-lab .panel .head {
        display: flex;
        padding: 8px 14px;
        border-bottom: 1px solid var(--brut-rule);
        font-size: 11px;
        color: var(--brut-ink-3);
        background: var(--brut-bg-2);
        align-items: center;
        gap: 12px;
    }
    .brut-lab .panel .head .tab {
        padding: 0 12px;
        border-right: 1px solid var(--brut-rule);
        margin-right: -1px;
        color: var(--brut-ink);
        background: var(--brut-bg);
    }
    .brut-lab .panel .head .grow {
        flex: 1;
    }
    .brut-lab .panel .head .ctrl {
        background: transparent;
        border: 1px solid var(--brut-rule);
        padding: 4px 10px;
        font-family: inherit;
        font-size: 11px;
        color: var(--brut-ink-2);
        cursor: pointer;
    }
    .brut-lab .panel .head .ctrl:hover {
        background: var(--brut-bg);
        color: var(--brut-ink);
    }
    .brut-lab .panel .head .ctrl.primary {
        border-color: var(--brut-accent);
        background: var(--brut-accent);
        color: var(--brut-accent-ink);
        font-weight: 600;
    }
    .brut-lab .panel .head .ctrl.primary:hover {
        filter: brightness(0.95);
    }
    /* Secondary controls strip below the head — keeps the head minimal
       like svelte-markdown's playground while exposing the live knobs. */
    .brut-lab .panel .strip {
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 6px 14px;
        border-bottom: 1px solid var(--brut-rule);
        font-size: 11px;
        background: var(--brut-bg);
        flex-wrap: wrap;
    }
    .brut-lab .panel .strip .strip-lbl,
    .brut-lab .panel .strip .strip-toggle,
    .brut-lab .panel .strip .strip-status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }
    .brut-lab .panel .strip .strip-k {
        color: var(--brut-ink-3);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-size: 10px;
    }
    .brut-lab .panel .strip .strip-v {
        color: var(--brut-ink);
        font-variant-numeric: tabular-nums;
    }
    .brut-lab .panel .strip .strip-v.accent {
        color: var(--brut-accent);
    }
    .brut-lab .panel .strip input[type='range'] {
        accent-color: var(--brut-accent);
        width: 120px;
    }
    .brut-lab .panel .strip .strip-toggle {
        background: transparent;
        border: 1px solid var(--brut-rule);
        padding: 3px 10px;
        cursor: pointer;
        font-family: inherit;
        color: var(--brut-ink-2);
    }
    .brut-lab .panel .strip .strip-toggle:hover {
        border-color: var(--brut-accent);
        color: var(--brut-ink);
    }
    .brut-lab .panel .strip .strip-spacer {
        flex: 1;
    }
    .brut-lab .panel .body {
        padding: 28px 22px 36px;
    }
    .brut-lab .panel .body .vgrid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 10px;
    }
    .brut-lab .panel :global(.vcell) {
        aspect-ratio: 1 / 1;
        border: 1px solid var(--brut-rule);
        background: var(--brut-bg-2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        color: var(--brut-ink);
        will-change: transform;
        position: relative;
    }
    .brut-lab .panel :global(.vcell::after) {
        content: '';
        position: absolute;
        inset: 0;
        border: 1px solid transparent;
        pointer-events: none;
        transition: border-color 0.2s;
    }
    /* When a cell is lifted (scaled > 1 means it's in 'play' state), give
       it the accent border so the staggered cascade visibly lights up the
       grid as it propagates. We can't read motion-value state from CSS
       directly, so we tie the highlight to the 'lifted' class flipped
       by the same state machinery. */
    .brut-lab .panel :global(.vcell.lifted::after) {
        border-color: var(--brut-accent);
    }
    .brut-lab .panel :global(.vcell.lifted .vnum) {
        color: var(--brut-accent);
    }
    .brut-lab .panel :global(.vcell .vnum) {
        font-size: 13px;
        color: var(--brut-ink-2);
        transition: color 0.18s;
    }

    /* ── Compare table ────────────────────────────────────────────── */
    .brut-comp {
        padding: 28px 24px;
        border-bottom: 1px solid var(--brut-rule);
    }
    .brut-comp .k {
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-comp h2 {
        font-size: 28px;
        margin: 12px 0 24px;
        letter-spacing: -0.02em;
        text-transform: lowercase;
        font-weight: 500;
        color: var(--brut-ink);
    }
    .brut-comp h2 span {
        color: var(--brut-accent);
    }
    .brut-comp .comp-scroll {
        overflow-x: auto;
    }
    .brut-comp table {
        width: 100%;
        border-collapse: collapse;
        min-width: 720px;
    }
    .brut-comp table th,
    .brut-comp table td {
        text-align: left;
        padding: 12px 14px;
        border-bottom: 1px solid var(--brut-rule);
        font-size: 13px;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        color: var(--brut-ink);
    }
    .brut-comp table th {
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
        font-weight: 400;
        text-transform: lowercase;
    }
    .brut-comp table td.us {
        color: var(--brut-accent);
    }
    .brut-comp table .y {
        color: var(--brut-accent);
    }
    .brut-comp table .n {
        color: var(--brut-ink-3);
    }
    .brut-comp table tbody tr:hover {
        background: var(--brut-bg-2);
    }
    .brut-comp table tr.us-row {
        background: var(--brut-accent-soft);
    }
    .brut-comp table tr.us-row:hover {
        background: var(--brut-accent-soft);
    }
    .brut-comp .lede-p {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 13.5px;
        color: var(--brut-ink-2);
        margin: 0 0 24px;
        line-height: 1.55;
        max-width: 720px;
    }

    /* ── Examples grid ────────────────────────────────────────────── */
    .brut-ex {
        padding: 28px 24px;
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 24px;
        border-bottom: 1px solid var(--brut-rule);
    }
    .brut-ex .lede .k {
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-ex .lede h2 {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 28px;
        color: var(--brut-ink);
        margin: 12px 0 0;
        letter-spacing: -0.02em;
        text-transform: lowercase;
        font-weight: 500;
    }
    .brut-ex .lede h2 span {
        color: var(--brut-accent);
    }
    .brut-ex .lede p {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        color: var(--brut-ink-2);
        margin: 12px 0 0;
        font-size: 13px;
        line-height: 1.55;
        max-width: 640px;
    }
    .brut-ex .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        border-left: 1px solid var(--brut-rule);
        border-top: 1px solid var(--brut-rule);
    }
    .brut-ex .cell {
        display: block;
        border-right: 1px solid var(--brut-rule);
        border-bottom: 1px solid var(--brut-rule);
        padding: 20px 22px;
        min-height: 200px;
        position: relative;
        color: var(--brut-ink);
        text-decoration: none;
    }
    .brut-ex .cell::after {
        content: '';
        position: absolute;
        inset: 8px;
        border: 1px solid transparent;
        pointer-events: none;
        transition: border-color 0.2s;
    }
    .brut-ex .cell:hover::after {
        border-color: var(--brut-accent);
    }
    .brut-ex .cell .id {
        font-size: 10.5px;
        color: var(--brut-ink-3);
        letter-spacing: 0.14em;
    }
    .brut-ex .cell h3 {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 22px;
        font-weight: 500;
        letter-spacing: -0.02em;
        margin: 30px 0 8px;
        color: var(--brut-ink);
    }
    .brut-ex .cell p {
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 13.5px;
        color: var(--brut-ink-2);
        line-height: 1.55;
        margin: 0;
        max-width: 320px;
    }
    .brut-ex .cell .corner {
        position: absolute;
        top: 14px;
        right: 16px;
        font-size: 14px;
        color: var(--brut-ink-3);
        transition: color 0.2s;
    }
    .brut-ex .cell:hover .corner {
        color: var(--brut-accent);
    }
    .brut-ex .cell .marker {
        width: 14px;
        height: 14px;
        border: 1px solid var(--brut-ink-3);
        position: absolute;
        bottom: 16px;
        right: 16px;
    }
    .brut-ex .cell:nth-child(3n + 1) .marker {
        background: var(--brut-accent);
        border-color: var(--brut-accent);
    }
    .brut-ex .ex-all {
        display: inline-block;
        margin-top: 18px;
        color: var(--brut-accent);
        text-decoration: none;
        font-size: 12px;
        letter-spacing: 0.08em;
    }
    .brut-ex .ex-all:hover {
        text-decoration: underline;
    }

    /* ── Footer big-type ──────────────────────────────────────────── */
    .brut-foot {
        padding: 60px 24px 36px;
        display: grid;
        grid-template-columns: 200px 1fr 200px;
        gap: 24px;
        border-top: 1px solid var(--brut-rule);
        align-items: end;
    }
    .brut-foot :global(.big) {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: clamp(40px, 7vw, 96px);
        line-height: 0.9;
        letter-spacing: -0.06em;
        text-transform: lowercase;
        background: transparent;
        border: 0;
        color: var(--brut-ink);
        text-align: left;
        cursor: pointer;
        padding: 0;
        position: relative;
    }
    .brut-foot :global(.big span) {
        color: var(--brut-accent);
    }
    .brut-foot :global(.big .copy-hint) {
        display: inline-grid;
        align-items: center;
        justify-items: start;
        margin-top: 16px;
        height: 16px;
        font-size: 11px;
        letter-spacing: 0.14em;
        color: var(--brut-ink-3);
        text-transform: uppercase;
        overflow: hidden;
        min-width: 200px;
    }
    .brut-foot :global(.big .copy-hint-label) {
        grid-area: 1 / 1;
        display: inline-block;
        white-space: nowrap;
        will-change: transform, opacity;
    }
    .brut-foot :global(.big:hover .copy-hint) {
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

    /* ── Responsive collapse ─────────────────────────────────────── */
    @media (max-width: 1024px) {
        .brut-stats {
            grid-template-columns: repeat(3, 1fr);
        }
        .brut-stats .s:nth-child(3n) {
            border-right: 0;
        }
        .brut-stats .s:nth-child(-n + 3) {
            border-bottom: 1px solid var(--brut-rule);
        }
        .brut-feat .grid,
        .brut-ex .grid {
            grid-template-columns: repeat(2, 1fr);
        }
        .brut-lab .panel :global(.vgrid) {
            grid-template-columns: repeat(4, 1fr);
        }
        .brut-ex {
            grid-template-columns: 1fr;
        }
    }
    @media (max-width: 720px) {
        .brut-coord {
            display: none;
        }
        .brut-hero,
        .brut-demo,
        .brut-feat,
        .brut-lab,
        .brut-ex {
            grid-template-columns: 1fr;
            padding-left: 16px;
            padding-right: 16px;
        }
        .brut-hero {
            padding-top: 56px;
        }
        .brut-stats {
            grid-template-columns: repeat(2, 1fr);
        }
        .brut-stats .s {
            min-height: 130px;
            padding: 20px 16px;
        }
        .brut-stats .s .v {
            font-size: 44px;
        }
        .brut-stats .s:nth-child(2n) {
            border-right: 0;
        }
        .brut-stats .s:not(:nth-last-child(-n + 2)) {
            border-bottom: 1px solid var(--brut-rule);
        }
        .brut-feat .grid,
        .brut-ex .grid {
            grid-template-columns: 1fr;
        }
        .brut-lab .panel :global(.vgrid) {
            grid-template-columns: repeat(3, 1fr);
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
