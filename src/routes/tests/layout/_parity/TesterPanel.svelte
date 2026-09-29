<script lang="ts" module>
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
</script>

<script lang="ts">
    import { onMount, type Snippet } from 'svelte'

    /**
     * Fixed right-hand guide for the LayoutGroup parity test pages.
     *
     * Renders nothing under Playwright (`?@isPlaywright=true`) and nothing
     * during SSR: it only mounts on the client after hydration, so the
     * fixture's DOM and layout are exactly what the parity specs measure. The
     * panel is `position: fixed`, so it never affects the fixture's layout.
     *
     * @prop eyebrow Short kicker above the title (e.g. the upstream file).
     * @prop title Page title.
     * @prop checks "What this page checks" body.
     * @prop steps Numbered "Try this" steps.
     * @prop status "Status on this build" note.
     * @prop children Optional live readout (e.g. a `JumpMeter`).
     */
    let {
        eyebrow,
        title,
        checks,
        steps,
        status = 'See the page’s e2e spec for its current status on this build.',
        children
    }: {
        eyebrow: string
        title: string
        checks: Snippet
        steps: TesterStep[]
        status?: string
        children?: Snippet
    } = $props()

    let show = $state(false)

    onMount(() => {
        // Same check as the other test pages; evaluated client-side only so
        // Playwright runs never see the panel (not even in SSR markup).
        show = !window.location.search.includes('@isPlaywright=true')
    })
</script>

{#if show}
    <aside class="tester-panel" aria-label="Tester guide">
        <header>
            <p class="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
        </header>

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
            <button type="button" class="reset" onclick={() => window.location.reload()}>
                Reset page
            </button>
        </section>

        {#if children}
            <section>
                <h2>Live readout</h2>
                {@render children()}
            </section>
        {/if}

        <section class="status">
            <h2>Status on this build</h2>
            <p>{status}</p>
        </section>
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
    .eyebrow {
        margin: 0 0 4px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 10px;
        font-weight: 700;
        color: #5c6b80;
    }
    h1 {
        margin: 0 0 14px;
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
        margin: 0 0 12px;
        color: #4c5b6e;
    }
    li {
        margin-bottom: 12px;
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
    }
    button:hover {
        background: #f0f4f8;
    }
    button.primary {
        color: #fff;
        background: #12628e;
        border-color: #12628e;
    }
    button.primary:hover {
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
