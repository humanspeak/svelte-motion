<script lang="ts">
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../layout/_parity/TesterPanel.svelte'

    /**
     * String `style` props whose declarations need the browser's own parsing,
     * driven by `e2e/utilities/style-string-declarations.spec.ts`.
     *
     * - `fallback`: `height: 50px; height: 1furlong`. `1furlong` is an invalid
     *   length, so the browser drops it and keeps `50px`, but only if both
     *   declarations reach the element's `style` attribute.
     * - `data-uri`: a `background-image` data URI whose `;base64,` must not end
     *   the declaration, next to an `initial` opacity Motion writes.
     *
     * No upstream twin: framer-motion's `style` prop is object-only.
     */
    // A deliberate fallback pair, held in a constant so the string reaches the
    // prop verbatim (a static attribute would trip no-dupe-style-properties).
    const FALLBACK_STYLE = 'width: 40px; height: 50px; height: 1furlong; background: #38bdf8'

    let isTester = $state(false)
    let fallback = $state<HTMLElement | null>(null)
    let dataUri = $state<HTMLElement | null>(null)
    let fallbackHeight = $state('')
    let backgroundImageOk = $state(false)

    const steps: TesterStep[] = [
        {
            text: 'Load the page.',
            expected:
                'The first (blue) box is 50px tall. The second box is pale green: its background is a one-pixel green PNG data URI stretched to fill the box, shown at half opacity. An empty box would mean the URL was cut at its ";".'
        }
    ]

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        if (!isTester) return
        if (fallback) fallbackHeight = getComputedStyle(fallback).height
        if (dataUri)
            backgroundImageOk = getComputedStyle(dataUri).backgroundImage.includes('base64')
    })
</script>

<svelte:head>
    <title>Style strings keep data URIs and fallbacks</title>
</svelte:head>

<div class="page">
    <motion.div data-testid="fallback" bind:ref={fallback} style={FALLBACK_STYLE} />
    <motion.div
        data-testid="data-uri"
        bind:ref={dataUri}
        initial={{ opacity: 0.5 }}
        style="width: 40px; height: 40px; background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='); background-size: cover"
    />
</div>

{#if isTester}
    <TesterPanel
        eyebrow="e2e/utilities/style-string-declarations.spec.ts"
        title="String style declarations"
        status="Expected to pass on this build: both verdicts read PASS as soon as the page loads."
        {steps}
    >
        {#snippet checks()}
            <p>
                A string <code>style</code> on a <code>motion.*</code> element must reach the
                browser the way a plain <code>&lt;div style="…"&gt;</code> does: a
                <code>;</code> inside a data URI must not cut the value, and a CSS fallback pair (<code
                    >height: 50px; height: 1furlong</code
                >) must keep both members so the browser can drop the invalid one.
            </p>
        {/snippet}

        <dl class="verdicts" data-testid="verdicts">
            <dt>Fallback box height ({fallbackHeight})</dt>
            <dd>
                {#if fallbackHeight === '50px'}
                    <span class="verdict ok">PASS</span>
                {:else}
                    <span class="verdict bad">FAIL</span>
                {/if}
            </dd>
            <dt>Data URI background image</dt>
            <dd>
                {#if backgroundImageOk}
                    <span class="verdict ok">PASS</span>
                {:else}
                    <span class="verdict bad">FAIL</span>
                {/if}
            </dd>
        </dl>
    </TesterPanel>
{/if}

<style>
    .page {
        display: flex;
        gap: 16px;
        padding: 32px 16px;
    }

    .verdicts {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 4px 12px;
        margin: 0;
        font-size: 12px;
    }

    .verdicts dd {
        margin: 0;
        text-align: right;
        font-family: monospace;
    }

    .verdict {
        display: inline-block;
        margin-left: 0.25rem;
        padding: 0.05rem 0.45rem;
        border-radius: 999px;
        font-weight: 600;
    }

    .verdict.ok {
        background: #dcfce7;
        color: #166534;
    }

    .verdict.bad {
        background: #fee2e2;
        color: #991b1b;
    }
</style>
