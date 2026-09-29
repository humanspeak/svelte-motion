<script lang="ts" module>
    import { getContext, onMount, setContext, type Snippet } from 'svelte'

    /**
     * One guided step in a {@link TesterPanel}.
     *
     * @property text What the tester should do, in plain language.
     * @property expected What they should see if the behaviour is correct.
     * @property action Optional "Do it" button that performs the step for them
     *     (e.g. dispatches a native click on a fixture element).
     */
    export type TesterStep = {
        text: string
        expected: string
        action?: { label?: string; run: () => void }
    }

    const SUMMARY_KEY = Symbol('tester-panel-summary')

    type SummaryRegistry = { set: (summary: Snippet | null) => void }

    /**
     * Lets a live readout rendered inside a {@link TesterPanel} (e.g.
     * `JumpMeter`) put a one-line summary in the panel's compact bar, so the
     * verdict stays visible while the panel is collapsed on narrow screens.
     *
     * Must be called during component initialisation. It is a no-op outside a
     * `TesterPanel`. A `summary` snippet passed to the panel directly wins.
     *
     * @param summary Compact, single-line snippet (verdict chip + number).
     */
    export function registerTesterSummary(summary: Snippet) {
        const registry = getContext<SummaryRegistry | undefined>(SUMMARY_KEY)
        if (!registry) return
        registry.set(summary)
        $effect(() => () => registry.set(null))
    }
</script>

<script lang="ts">
    /**
     * Guide for human testers on the parity / regression test pages.
     *
     * Renders nothing under Playwright (`?@isPlaywright=true`) and nothing
     * during SSR: it only mounts on the client after hydration, so the
     * fixture's DOM and layout are exactly what the specs measure.
     *
     * - At {@link WIDE_QUERY} widths it is a `position: fixed` 360px column on
     *   the right.
     * - Narrower (e.g. a ~600px in-app browser) it becomes a bottom sheet,
     *   collapsed by default to a compact bar with the title, the live
     *   summary and Reset / Steps buttons. While it is shown, `<body>` gets a
     *   matching `padding-bottom`, so everything in the page's flow can be
     *   scrolled clear of the sheet. Fixtures never move: the padding only adds
     *   room after them, and it is never applied under Playwright. Fixture
     *   controls pinned to the bottom of the window (`position: fixed`) can't
     *   be scrolled clear, so the sheet sits just above them instead.
     *
     * @prop eyebrow Short kicker above the title (e.g. the upstream file).
     * @prop title Page title.
     * @prop checks "What this page checks" body.
     * @prop steps Numbered "Try this" steps.
     * @prop status "Status on this build" note.
     * @prop summary Optional one-line live summary. Shown in the collapsed bar
     *     and at the top of the live readout, which then moves to the top of
     *     the panel.
     * @prop children Optional live readout (e.g. a `JumpMeter`). Stays mounted
     *     while the sheet is collapsed, so it keeps recording.
     */
    let {
        eyebrow,
        title,
        checks,
        steps,
        status = 'See the page’s e2e spec for its current status on this build.',
        summary,
        children
    }: {
        eyebrow: string
        title: string
        checks: Snippet
        steps: TesterStep[]
        status?: string
        summary?: Snippet
        children?: Snippet
    } = $props()

    /** Viewports at least this wide get the right-hand column layout. */
    const WIDE_QUERY = '(min-width: 1100px)'

    let show = $state(false)
    let narrow = $state(false)
    let expanded = $state(false)
    let panel = $state<HTMLElement | null>(null)
    let registeredSummary = $state<Snippet | null>(null)
    /** Height of bottom-pinned fixture controls the sheet must sit above. */
    let lift = $state(0)

    setContext<SummaryRegistry>(SUMMARY_KEY, {
        set: (next) => (registeredSummary = next)
    })

    const barSummary = $derived(summary ?? registeredSummary)

    onMount(() => {
        // Same check as the other test pages; evaluated client-side only so
        // Playwright runs never see the panel (not even in SSR markup).
        show = !window.location.search.includes('@isPlaywright=true')
        if (!show) return
        const wide = window.matchMedia(WIDE_QUERY)
        const update = () => (narrow = !wide.matches)
        update()
        wide.addEventListener('change', update)
        return () => wide.removeEventListener('change', update)
    })

    // Narrow layout: reserve room below the page so the sheet never covers
    // the end of the fixture. Restores the original inline value afterwards.
    $effect(() => {
        if (!narrow || !panel) return
        const sheet = panel
        const body = document.body
        const original = body.style.paddingBottom
        let lifted = 0
        const pad = () => {
            const height = Math.ceil(sheet.getBoundingClientRect().height)
            body.style.paddingBottom = `${height + lifted}px`
        }
        const observer = new ResizeObserver(pad)
        observer.observe(sheet)

        const measureLift = () => {
            let next = 0
            for (const element of document.body.querySelectorAll<HTMLElement>('*')) {
                if (sheet.contains(element) || getComputedStyle(element).position !== 'fixed') {
                    continue
                }
                const rect = element.getBoundingClientRect()
                if (rect.height > 0 && rect.bottom >= window.innerHeight - 2) {
                    next = Math.max(next, window.innerHeight - rect.top)
                }
            }
            lifted = Math.ceil(next)
            lift = lifted
            pad()
        }
        measureLift()
        window.addEventListener('resize', measureLift)
        return () => {
            observer.disconnect()
            window.removeEventListener('resize', measureLift)
            body.style.paddingBottom = original
            lift = 0
        }
    })
</script>

{#snippet readout()}
    <section>
        <h2>Live readout</h2>
        {#if summary}
            <div class="readout-summary">{@render summary()}</div>
        {/if}
        {@render children?.()}
    </section>
{/snippet}

{#if show}
    <aside
        bind:this={panel}
        class="tester-panel"
        style:bottom={narrow && lift ? `${lift}px` : null}
        class:narrow
        class:expanded
        aria-label="Tester guide"
    >
        <header>
            <div class="heading">
                <p class="eyebrow">{eyebrow}</p>
                <h1>{title}</h1>
            </div>
            <div class="header-actions">
                <button type="button" class="reset" onclick={() => window.location.reload()}>
                    Reset page
                </button>
                {#if narrow}
                    <button
                        type="button"
                        class="toggle"
                        aria-expanded={expanded}
                        aria-controls="tester-panel-body"
                        onclick={() => (expanded = !expanded)}
                    >
                        {expanded ? 'Hide steps ▾' : 'Show steps ▴'}
                    </button>
                {/if}
            </div>
        </header>

        <!-- Collapsed sheet: the live verdict stays in view. Wide column: a
             readout's registered summary sits under the title, above the
             steps (a page-level summary heads the body instead). -->
        {#if barSummary && (narrow ? !expanded : !summary)}
            <div class="bar-summary">{@render barSummary()}</div>
        {/if}

        <div class="body" id="tester-panel-body" hidden={narrow && !expanded}>
            {#if summary}
                <!-- A page-level summary is the headline: readout goes first. -->
                {@render readout()}
            {/if}

            <section>
                <h2>What this page checks</h2>
                <div class="checks">{@render checks()}</div>
            </section>

            <section>
                <h2>Try this</h2>
                <ol>
                    {#each steps as step, index (index)}
                        <li>
                            <p>{step.text}</p>
                            <p class="expected"><strong>Expected:</strong> {step.expected}</p>
                            {#if step.action}
                                <button type="button" class="primary" onclick={step.action.run}>
                                    {step.action.label ?? 'Do it'}
                                </button>
                            {/if}
                        </li>
                    {/each}
                </ol>
            </section>

            {#if children && !summary}
                {@render readout()}
            {/if}

            <section class="status">
                <h2>Status on this build</h2>
                <p>{status}</p>
            </section>
        </div>
    </aside>
{/if}

<style>
    .tester-panel {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        width: 360px;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 20px;
        background: #f4f6f9;
        border-left: 1px solid #dce3eb;
        box-shadow: -4px 0 16px #1b2b4510;
        color: #182437;
        font:
            13px/1.55 system-ui,
            sans-serif;
    }
    /* Narrow viewports: a bottom sheet instead of a column over the fixture. */
    .tester-panel.narrow {
        top: auto;
        left: 0;
        width: auto;
        max-height: 50vh;
        padding: 10px 14px;
        border-left: none;
        border-top: 1px solid #c9d3df;
        border-radius: 14px 14px 0 0;
        box-shadow: 0 -4px 18px #1b2b4524;
    }
    header {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 14px;
    }
    .heading {
        flex: 1;
        min-width: 0;
    }
    .header-actions {
        display: flex;
        flex-shrink: 0;
        gap: 6px;
    }
    .header-actions button {
        margin-top: 0;
    }
    .narrow header {
        align-items: center;
        margin-bottom: 0;
    }
    .narrow.expanded header {
        position: sticky;
        top: -10px;
        z-index: 1;
        margin: -10px -14px 10px;
        padding: 10px 14px;
        background: #f4f6f9;
        border-bottom: 1px solid #dce3eb;
    }
    .narrow .eyebrow {
        display: none;
    }
    .narrow h1 {
        margin: 0;
        font-size: 15px;
        line-height: 1.3;
    }
    .narrow:not(.expanded) h1 {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .bar-summary {
        margin-top: 8px;
        padding: 6px 10px;
        border: 1px solid #dce3eb;
        border-radius: 10px;
        background: #fff;
    }
    .tester-panel:not(.narrow) .bar-summary {
        margin: -4px 0 12px;
    }
    .readout-summary {
        margin-bottom: 12px;
    }
    .body[hidden] {
        display: none;
    }
    .eyebrow {
        margin: 0 0 4px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 10px;
        font-weight: 700;
        color: #5c6b80;
    }
    h1 {
        margin: 0;
        font-size: 20px;
        line-height: 1.2;
        letter-spacing: -0.03em;
        font-weight: 750;
    }
    section {
        padding: 14px 16px;
        border: 1px solid #dce3eb;
        border-radius: 12px;
        background: #fff;
        margin-bottom: 12px;
    }
    h2 {
        margin: 0 0 8px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #12628e;
    }
    .checks :global(p) {
        margin: 0 0 8px;
        color: #43536a;
    }
    .checks :global(p:last-child) {
        margin-bottom: 0;
    }
    ol {
        list-style: decimal;
        padding-left: 20px;
        margin: 0;
        color: #4c5b6e;
    }
    li {
        margin-bottom: 12px;
    }
    li:last-child {
        margin-bottom: 0;
    }
    li p {
        margin: 0 0 4px;
    }
    .expected {
        padding: 6px 10px;
        background: #eef8fe;
        border-left: 3px solid #12628e;
        border-radius: 0 6px 6px 0;
        font-size: 12px;
        color: #43536a;
    }
    strong {
        font-weight: 650;
        color: #26364b;
    }
    button {
        font:
            600 12px/1.4 system-ui,
            sans-serif;
        border: 1px solid #ccd6e2;
        border-radius: 8px;
        padding: 6px 12px;
        background: #fff;
        color: #34465d;
        cursor: pointer;
        margin-top: 4px;
        white-space: nowrap;
    }
    button:hover {
        background: #f0f4f8;
    }
    button.primary,
    button.toggle {
        color: #fff;
        background: #12628e;
        border-color: #12628e;
    }
    button.primary:hover,
    button.toggle:hover {
        filter: brightness(0.9);
    }
    button:focus-visible {
        outline: 3px solid #4093cc;
        outline-offset: 2px;
    }
    .status {
        background: #fff6eb;
        border-color: #f1d3ad;
    }
    .status h2 {
        color: #9a500c;
    }
    .status p {
        margin: 0;
        color: #5b3a12;
    }
</style>
