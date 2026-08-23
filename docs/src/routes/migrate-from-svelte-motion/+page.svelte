<script lang="ts">
    import { browser } from '$app/environment'
    import favicon from '$lib/assets/logo.svg'
    import { docsConfig } from '$lib/docs-config'
    import { FooterV2, getBreadcrumbContext, getSeoContext, HeaderV2 } from '@humanspeak/docs-kit'
    import '@fontsource-variable/inter/index.css'
    import '@fontsource-variable/jetbrains-mono/index.css'
    import posthog from 'posthog-js'
    import rootPkg from '../../../../package.json'

    const PKG_VERSION = rootPkg.version

    const breadcrumbs = getBreadcrumbContext()
    if (breadcrumbs) breadcrumbs.breadcrumbs = [{ title: 'Migrate from svelte-motion' }]

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'Migrate from svelte-motion to Svelte Motion'
        seo.description =
            'Upgrade the dormant svelte-motion package to a runes-native Svelte 5 animation library with AnimatePresence, gestures, layout transitions, drag, and SSR support.'
        seo.ogTitle = 'Migrate from svelte-motion'
        seo.ogTagline = 'A practical Svelte 5 migration to @humanspeak/svelte-motion.'
        seo.ogFeatures = ['Svelte 5 Runes', 'AnimatePresence', 'Layout Animation', 'SSR-safe']
        seo.ogSlug = 'migrate-from-svelte-motion'
    }

    $effect(() => {
        if (browser) posthog.capture('svelte_motion_migration_viewed')
    })

    const mappings = [
        ['Motion', 'motion.div or MotionDiv'],
        ['initial / animate / transition', 'initial / animate / transition'],
        ['exit', 'exit inside AnimatePresence'],
        ['variants', 'variants with parent → child propagation'],
        ['spring / tween transitions', 'spring / tween transitions'],
        ['drag', 'drag with constraints, momentum, and elastic'],
        ['layout', 'layout and shared layoutId transitions']
    ]
</script>

<div class="flex min-h-svh flex-col bg-[var(--brut-paper)] text-[var(--brut-ink)]">
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

    <main class="mx-auto w-full max-w-5xl flex-1 px-5 py-16 sm:px-8 sm:py-24">
        <div class="mb-8 font-mono text-xs tracking-[0.18em] text-[var(--brut-ink-3)] uppercase">
            Migration guide · Svelte 5
        </div>
        <h1 class="max-w-4xl text-5xl leading-[0.95] font-black tracking-[-0.05em] sm:text-7xl">
            Move from <code>svelte-motion</code> without giving up the Motion API.
        </h1>
        <p class="mt-8 max-w-3xl text-lg leading-8 text-[var(--brut-ink-2)] sm:text-xl">
            The unscoped <code>svelte-motion</code> package has not released since February 2024.
            <code>@humanspeak/svelte-motion</code> is built for Svelte 5 runes and actively tracks the
            modern Motion API, including presence, gestures, drag, FLIP layout animation, shared-layout
            transitions, springs, scroll effects, and SSR-safe SvelteKit rendering.
        </p>

        <div class="mt-10 flex flex-wrap gap-3">
            <a class="primary" href="#install">Start migrating</a>
            <a class="secondary" href="/examples">See live examples</a>
            <a class="secondary" href="/compare/framer-motion">Compare with Framer Motion</a>
        </div>

        <section id="install">
            <p class="eyebrow">01 · Replace the package</p>
            <h2>Change the dependency and imports.</h2>
            <pre><code
                    >pnpm remove svelte-motion
pnpm add @humanspeak/svelte-motion</code
                ></pre>
            <pre><code
                    >{`// Before
import { Motion } from 'svelte-motion'

// After: familiar proxy syntax
import { motion } from '@humanspeak/svelte-motion'

// Or tree-shakeable named components
import { MotionDiv } from '@humanspeak/svelte-motion'`}</code
                ></pre>
            <p>
                This is a source migration, not a package alias: update imports and replace generic
                <code>Motion</code> usage with <code>motion.tag</code> or the matching named component.
            </p>
        </section>

        <section>
            <p class="eyebrow">02 · Map the concepts</p>
            <h2>Most animation intent transfers directly.</h2>
            <table class="mapping">
                <caption class="sr-only">API migration mapping</caption>
                <thead>
                    <tr class="mapping-head">
                        <th scope="col">svelte-motion</th>
                        <th scope="col">@humanspeak/svelte-motion</th>
                    </tr>
                </thead>
                <tbody>
                    {#each mappings as mapping (mapping[0])}
                        <tr class="mapping-row">
                            <td><code>{mapping[0]}</code></td>
                            <td>{mapping[1]}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </section>

        <section>
            <p class="eyebrow">03 · Handle conditional exits</p>
            <h2>Put removed elements inside AnimatePresence.</h2>
            <pre><code
                    >{`<script>
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'
    let open = $state(true)
</scr${'ipt'}>

<AnimatePresence>
    {#if open}
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
        >
            Content
        </motion.div>
    {/if}
</AnimatePresence>`}</code
                ></pre>
            <p>
                Use <code>mode="wait"</code> for sequential replacement or
                <code>mode="popLayout"</code> when exiting items should leave the document flow. See
                the <a href="/examples/animate-presence">live AnimatePresence example</a>.
            </p>
        </section>

        <section>
            <p class="eyebrow">04 · Adopt Svelte 5 patterns</p>
            <h2>Use runes for state; let Motion own animation state.</h2>
            <ul>
                <li>
                    Keep application state in <code>$state</code> and derived targets in
                    <code>$derived</code>.
                </li>
                <li>
                    Use <code>whileHover</code>, <code>whileTap</code>, <code>whileFocus</code>, and
                    <code>whileInView</code> instead of manual event-state wiring.
                </li>
                <li>
                    Add <code>layout</code> to animate reflow, or a shared <code>layoutId</code> to connect
                    elements across states.
                </li>
                <li>
                    Use <code>useMotionValue</code>, <code>useSpring</code>, and
                    <code>useTransform</code> for continuously reactive values.
                </li>
            </ul>
            <div class="links">
                <a href="/examples/hover-and-tap">Gestures ↗</a>
                <a href="/examples/shared-layout-animation">Shared layout ↗</a>
                <a href="/examples/drag-constraints">Drag constraints ↗</a>
                <a href="/examples/scroll-progress">Scroll-linked motion ↗</a>
            </div>
        </section>

        <section class="checklist">
            <p class="eyebrow">05 · Verify before shipping</p>
            <h2>Migration checklist.</h2>
            <ul>
                <li>Search for every import from <code>svelte-motion</code>.</li>
                <li>Verify conditional elements complete their exit animation.</li>
                <li>Test drag constraints and layout transitions at responsive breakpoints.</li>
                <li>Load the route directly in SvelteKit to exercise SSR and hydration.</li>
                <li>Test keyboard focus and the operating system’s reduced-motion preference.</li>
            </ul>
            <a class="primary" href="/docs">Read the API docs</a>
        </section>
    </main>

    <FooterV2 version={PKG_VERSION} />
</div>

<style>
    section {
        margin-top: 5rem;
        border-top: 1px solid var(--brut-rule);
        padding-top: 2rem;
    }
    h2 {
        max-width: 48rem;
        font-size: clamp(2rem, 5vw, 3.5rem);
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.045em;
    }
    section > p:not(.eyebrow) {
        margin-top: 1.25rem;
        max-width: 48rem;
        line-height: 1.75;
        color: var(--brut-ink-2);
    }
    .eyebrow {
        margin-bottom: 1rem;
        font-family: 'JetBrains Mono Variable', monospace;
        font-size: 0.75rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--brut-accent);
    }
    pre {
        margin-top: 1.5rem;
        overflow-x: auto;
        border: 1px solid var(--brut-rule);
        background: var(--brut-surface);
        padding: 1.25rem;
        font-size: 0.85rem;
        line-height: 1.7;
    }
    code {
        font-family: 'JetBrains Mono Variable', monospace;
    }
    .primary,
    .secondary {
        display: inline-flex;
        border: 1px solid var(--brut-rule);
        padding: 0.75rem 1rem;
        font-family: 'JetBrains Mono Variable', monospace;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
    }
    .primary {
        background: var(--brut-ink);
        color: var(--brut-paper);
    }
    .mapping {
        margin-top: 2rem;
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
        border: 1px solid var(--brut-rule);
        text-align: left;
    }
    .mapping-head > *,
    .mapping-row > * {
        padding: 0.9rem 1rem;
        font-weight: inherit;
    }
    .mapping-head > :first-child,
    .mapping-row > :first-child {
        width: 40%;
    }
    .mapping-head {
        background: var(--brut-ink);
        color: var(--brut-paper);
        font-family: 'JetBrains Mono Variable', monospace;
        font-size: 0.72rem;
        text-transform: uppercase;
    }
    .mapping-row {
        border-top: 1px solid var(--brut-rule);
    }
    .mapping-row > :last-child,
    .mapping-head > :last-child {
        border-left: 1px solid var(--brut-rule);
    }
    section ul {
        margin-top: 1.5rem;
        max-width: 48rem;
        list-style: square;
        padding-left: 1.25rem;
        line-height: 1.8;
    }
    .links {
        margin-top: 2rem;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        border: 1px solid var(--brut-rule);
    }
    .links a {
        padding: 1rem;
        border: 1px solid var(--brut-rule);
        font-family: 'JetBrains Mono Variable', monospace;
        font-size: 0.8rem;
    }
    .checklist {
        margin-bottom: 3rem;
        background: var(--brut-surface);
        padding: 2rem;
    }
    .checklist .primary {
        margin-top: 2rem;
    }
    a:hover {
        color: var(--brut-accent);
    }
    .primary:hover {
        background: var(--brut-accent);
        color: white;
    }
    @media (max-width: 640px) {
        .links {
            grid-template-columns: 1fr;
        }
    }
</style>
