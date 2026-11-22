<!--
@component
AnimatePresence follows a runtime `mode` change (plan 011).

The mode picker changes the live boundary's `mode` with no remount. Each exit
samples the mode when it starts and keeps it: the exit clone's `data-mode`
shows which one it took. An enter held by `wait` is released when the exits
finish, whatever the mode is by then.
-->
<script lang="ts">
    import { AnimatePresence, motion } from '$lib'
    import type { AnimatePresenceMode } from '$lib/types'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    let mode = $state<AnimatePresenceMode>('sync')
    let card = $state<'a' | 'b'>('a')
    let completed = $state(0)

    // Read-only live readout: the running exit clone's `data-mode`, sampled
    // every frame. Nothing here writes to the fixture DOM.
    let cloneMode = $state<string | null>(null)

    onMount(() => {
        let frame = 0
        const sample = () => {
            const clone = document.querySelector<HTMLElement>('[data-clone="true"]')
            cloneMode = clone ? clone.getAttribute('data-mode') : null
            frame = requestAnimationFrame(sample)
        }
        frame = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(frame)
    })

    const steps: TesterStep[] = [
        {
            text: 'Pick wait, then press Swap card.',
            expected: 'The old card fades out first; the new card appears only after it is gone.'
        },
        {
            text: 'Pick popLayout, then press Swap card.',
            expected:
                'The two cards overlap: the leaving card is pinned in place while the new one fades in.'
        },
        {
            text: 'Pick sync, press Swap card, and pick wait while the card is fading.',
            expected:
                'The new card keeps fading in alongside the old one: the running exit keeps sync.'
        },
        {
            text: 'Pick wait, press Swap card, and pick sync while the card is fading.',
            expected: 'The new card still waits until the old one is gone.'
        }
    ]
</script>

<svelte:head>
    <title>AnimatePresence runtime mode switch</title>
</svelte:head>

<main>
    <h1>AnimatePresence runtime mode switch</h1>
    <div class="controls">
        <label
            >Presence mode
            <select bind:value={mode}>
                <option value="sync">sync</option>
                <option value="wait">wait</option>
                <option value="popLayout">popLayout</option>
            </select>
        </label>
        <button onclick={() => (card = card === 'a' ? 'b' : 'a')}>Swap card</button>
        <p>Completed exits: <output data-testid="completed-exits">{completed}</output></p>
    </div>

    <div class="stage" data-testid="stage">
        <AnimatePresence {mode} onExitComplete={() => completed++}>
            {#key card}
                <motion.div
                    key={card}
                    data-testid="mode-card"
                    data-card={card}
                    class="card"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, ease: 'linear' }}
                >
                    Card {card.toUpperCase()}
                </motion.div>
            {/key}
        </AnimatePresence>
    </div>
</main>

<TesterPanel
    eyebrow="AnimatePresence · mode"
    title="Mode changes at runtime"
    status="Passes on this build."
    {steps}
>
    {#snippet checks()}
        <p>
            The mode picker changes the live boundary with no remount. An exit keeps the mode it
            started with, and an enter held by <code>wait</code> is released when the exit ends.
        </p>
    {/snippet}

    <dl class="readout">
        <dt>Current mode</dt>
        <dd>{mode}</dd>
        <dt>Running exit</dt>
        <dd>{cloneMode ? `data-mode="${cloneMode}"` : 'none'}</dd>
    </dl>
</TesterPanel>

<style>
    main {
        padding: 2rem 400px 4rem 2rem;
        font-family: system-ui, sans-serif;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
        margin: 1rem 0;
    }

    .stage {
        display: flex;
        gap: 12px;
        min-height: 140px;
    }

    .stage :global(.card) {
        display: grid;
        place-items: center;
        width: 160px;
        height: 120px;
        border-radius: 12px;
        background: tomato;
        color: white;
        font-weight: 700;
    }

    .stage :global(.card[data-card='b']) {
        background: royalblue;
    }

    .readout {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.25rem 0.75rem;
        margin: 0;
    }

    .readout dd {
        margin: 0;
        font-family: ui-monospace, monospace;
    }

    @media (max-width: 720px) {
        main {
            padding: 1rem 16px 4rem;
        }
    }
</style>
