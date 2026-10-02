<script lang="ts">
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Port of upstream `animate-unresolved-origin` (Motion 13.5.0, motion #2791):
    // values animated without a base value must never render placeholders such
    // as `points="undefined"` / `NaN`, and a CSS variable must animate from its
    // inherited value (50), not from 0.

    const pointPairs = [
        ['0,20 550,38', '720,38 712,50 389,50 380,36'],
        ['710,38 712,50 389,50 380,36', '850,38 830,50 400,50 390,36']
    ]

    let runId = $state(0)

    // ---- Tester readout (never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    let cssVarValue = $state('–')

    onMount(() => {
        if (window.location.search.includes('@isPlaywright=true')) return
        isTester = true
        const timer = setInterval(() => {
            const el = document.getElementById('css-var')
            if (el) cssVarValue = getComputedStyle(el).getPropertyValue('--x').trim() || '–'
        }, 100)
        return () => clearInterval(timer)
    })

    const steps: TesterStep[] = [
        {
            text: 'Reload the page and watch the shapes.',
            expected:
                'Both shapes morph smoothly from the start. No flash, no shape collapsing to a corner.'
        },
        {
            text: 'Watch the "--x" readout for 10 seconds.',
            expected: 'It climbs steadily from 50 to 100. It never starts at 0.'
        }
    ]
</script>

<svelte:head>
    <title>SVG unresolved animation origins</title>
</svelte:head>

<main class="unresolved-origin">
    {#key runId}
        <svg width="900" height="100" data-testid="svg">
            {#each pointPairs as [from, to], i (i)}
                <motion.polygon
                    data-testid={`polygon-${i}`}
                    points={from}
                    fill={i === 0 ? '#60a5fa' : '#f472b6'}
                    animate={{ points: to }}
                    transition={{ delay: 0.2 * i, duration: 3, type: 'spring' }}
                />
            {/each}
        </svg>
        <div style="--x: 50">
            <motion.div
                id="css-var"
                data-testid="css-var"
                animate={{ '--x': 100 }}
                transition={{ ease: 'linear', duration: 10 }}
            />
        </div>
    {/key}
    <button type="button" data-testid="replay" onclick={() => runId++}>Replay</button>
</main>

<TesterPanel
    eyebrow="animate-unresolved-origin"
    title="Values animated without a base value never render placeholders"
    {steps}
>
    {#snippet checks()}
        <p>
            A value animated without a base value must not paint placeholders such as
            <code>points="undefined"</code>, and a CSS variable must start from its inherited value.
        </p>
    {/snippet}
    {#if isTester}
        <p class="detail">--x: <strong>{cssVarValue}</strong></p>
    {/if}
</TesterPanel>

<style>
    main {
        padding: 2rem;
    }
    button {
        margin-top: 1rem;
        padding: 0.25rem 0.75rem;
        border: 1px solid currentColor;
        border-radius: 0.25rem;
    }
</style>
