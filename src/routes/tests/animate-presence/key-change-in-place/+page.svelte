<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, motion } from '$lib'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * In-place key change during a key transition.
     *
     * The box is a direct `AnimatePresence` child whose `key` changes WITHOUT a
     * `{#key}` block, so svelte-motion runs exit -> rewind -> enter on the same
     * element. A second key change during that exit used to strand the box at
     * its exit target (opacity 0) for good.
     *
     * `e2e/animate-presence/key-change-in-place.spec.ts` drives the
     * `data-testid`s below; keep them stable.
     */
    const mode = page.url.searchParams.get('mode') === 'wait' ? 'wait' : 'sync'
    const isPlaywright =
        typeof window !== 'undefined' && window.location.search.includes('@isPlaywright=true')

    const labels = ['one', 'two', 'three', 'four'] as const
    let index = $state(0)
    const label = $derived(labels[index])

    const next = () => (index = (index + 1) % labels.length)
    const prev = () => (index = (index + labels.length - 1) % labels.length)

    const transition = { duration: isPlaywright ? 0.6 : 0.4, ease: 'linear' as const }

    /** Two key changes 150 ms apart, so the second lands inside the first exit. */
    const double = () => {
        next()
        setTimeout(next, 150)
    }

    /** A key change, then a change back to the exiting key 150 ms later. */
    const bounce = () => {
        next()
        setTimeout(prev, 150)
    }

    const steps: TesterStep[] = [
        {
            text: 'Press Two quick changes',
            expected:
                'The box fades out once, then fades in showing the label two steps on. It never stays invisible.',
            action: { label: 'Do it', run: double }
        },
        {
            text: 'Press Change and change back',
            expected:
                'The box starts to fade out, then fades straight back in with the same label. It does not jump up above its resting place first.',
            action: { label: 'Do it', run: bounce }
        },
        {
            text: 'Press Next key',
            expected:
                'The box still fades out and back in. Key changes keep working after steps 1 and 2.',
            action: { label: 'Do it', run: next }
        }
    ]
</script>

<svelte:head>
    <title>In-place key change during a key transition</title>
</svelte:head>

<div class="page">
    <h1>In-place key change during a key transition</h1>
    <p>Mode: <span data-testid="mode">{mode}</span></p>
    <div class="stage">
        <AnimatePresence {mode}>
            <motion.div
                key={label}
                data-testid="box"
                data-key={label}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                {transition}
                class="box"
            >
                {label}
            </motion.div>
        </AnimatePresence>
    </div>
    <div class="controls">
        <button data-testid="next" onclick={next}>Next key</button>
        <button data-testid="prev" onclick={prev}>Previous key</button>
        <button data-testid="double" onclick={double}>Two quick changes</button>
        <button data-testid="bounce" onclick={bounce}>Change and change back</button>
    </div>
</div>

<TesterPanel
    eyebrow="AnimatePresence · in-place key"
    title="A key change mid-transition ends on the latest key"
    status="Expected to pass on this build once plan 007 has landed."
    {steps}
>
    {#snippet checks()}
        <p>
            The box changes its <code>key</code> without a <code>{'{#key}'}</code> block, so
            svelte-motion runs exit, rewind and enter on the same element. A second change during
            the exit used to leave the box invisible for good. Add <code>?mode=wait</code> to the URL
            for the wait-mode variant.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .page {
        min-height: 100vh;
        padding: 48px 16px;
        background: #0f1115;
        color: #e5e7eb;
        font-family: system-ui, sans-serif;
    }

    h1 {
        font-size: 20px;
        margin-bottom: 8px;
    }

    p {
        max-width: 560px;
        margin-bottom: 24px;
        color: #9ca3af;
    }

    .stage {
        position: relative;
        width: 120px;
        height: 60px;
        margin-bottom: 24px;
    }

    :global(.box) {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        background: #22d3ee;
        color: #0f1115;
        font-weight: 600;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    button {
        padding: 8px 12px;
        border: 1px solid #374151;
        border-radius: 6px;
        background: #1f2937;
        color: #e5e7eb;
        cursor: pointer;
    }
</style>
