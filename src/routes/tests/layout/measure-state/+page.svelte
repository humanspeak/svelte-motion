<script lang="ts">
    /**
     * Regression page: an `onLayoutMeasure` callback that reads and writes
     * `$state` (`measures += 1`) must not loop. The library calls the callback
     * from inside its own layout effects, so any `$state` it read used to
     * become a dependency of those effects and re-run them until Svelte threw
     * `effect_update_depth_exceeded`. Upstream notifies from the projection
     * update, outside any render, so setting state there is safe.
     *
     * Driven by `e2e/layout/measure-state.spec.ts`.
     *
     * @component
     */
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../_parity/TesterPanel.svelte'

    let measures = $state(0)
    let lastBox = $state<string>('none')
    let wide = $state(false)
    let isTester = $state(false)

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
    })

    const steps: TesterStep[] = [
        {
            text: 'Load the page.',
            expected:
                'The count settles at a small number (4 today: the mount reports the same box a few times) and stays there.'
        },
        {
            text: 'Press Toggle a few times.',
            expected:
                'The count goes up by a small number per press and the size reads 120x80 or 240x80. The page never freezes.'
        }
    ]
</script>

<svelte:head>
    <title>onLayoutMeasure writing $state</title>
</svelte:head>

<div class="fixture">
    <motion.div
        layout
        data-testid="box"
        style="width: {wide ? 240 : 120}px; height: 80px; background: #ff0088; border-radius: 12px;"
        onLayoutMeasure={(box) => {
            measures += 1
            lastBox = `${Math.round(box.x.max - box.x.min)}x${Math.round(box.y.max - box.y.min)}`
        }}
    />

    <p class="outputs">
        measures: <output data-testid="measures">{measures}</output>
        · last box: <output data-testid="last-box">{lastBox}</output>
    </p>

    <button type="button" data-testid="toggle" onclick={() => (wide = !wide)}>Toggle</button>
</div>

{#if isTester}
    <TesterPanel
        eyebrow="e2e/layout/measure-state.spec.ts"
        title="onLayoutMeasure writing $state"
        status="Expected to pass on this build: the verdict stays PASS however often you press Toggle."
        {steps}
    >
        {#snippet checks()}
            <p>
                The box's <code>onLayoutMeasure</code> callback runs <code>measures += 1</code>,
                which reads and writes <code>$state</code>. Before the fix that re-ran the library's
                layout effects until Svelte threw <code>effect_update_depth_exceeded</code> and the page
                froze.
            </p>
        {/snippet}

        <dl class="verdicts" data-testid="verdicts">
            <dt>Measures</dt>
            <dd>{measures}</dd>
            <dt>Last box</dt>
            <dd>{lastBox}</dd>
            <dt>No effect loop</dt>
            <dd>
                {#if measures > 50}
                    <span class="verdict bad">FAIL</span>
                {:else if measures >= 1}
                    <span class="verdict ok">PASS</span>
                {:else}
                    <span class="verdict wait">not yet</span>
                {/if}
            </dd>
        </dl>
    </TesterPanel>
{/if}

<style>
    .fixture {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
        padding: 32px 16px;
        font-family: system-ui, sans-serif;
    }

    .outputs {
        margin: 0;
        font-size: 13px;
    }

    button {
        padding: 6px 14px;
        border: 1px solid #94a3b8;
        border-radius: 8px;
        background: #f1f5f9;
        color: #0f172a;
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

    .verdict.wait {
        background: #e2e8f0;
        color: #334155;
    }
</style>
