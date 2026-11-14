<script lang="ts">
    import { ArrowLeftRight } from '@lucide/svelte'
    import { motion } from '@humanspeak/svelte-motion'

    // Motion 14.13: a spring layout transition carries the element's velocity
    // through an interrupt. Toggle twice quickly: the spring puck swings round
    // and heads back at speed, while the tween puck stops dead and turns,
    // because a tween always starts the next layout animation from rest.
    const rows = [
        {
            label: 'spring: keeps its speed',
            transition: { type: 'spring', visualDuration: 0.6, bounce: 0.15 }
        },
        { label: 'tween: starts from rest', transition: { duration: 0.6 } }
    ] as const

    let isOn = $state(false)
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="toolbar" aria-label="Layout velocity controls">
        <button type="button" class="primary" onclick={() => (isOn = !isOn)}>
            <ArrowLeftRight size={15} />
            Toggle
        </button>
        <span class="hint">Click Toggle twice, quickly</span>
    </div>

    <div class="stage">
        {#each rows as row (row.label)}
            <div class="row">
                <span class="label">{row.label}</span>
                <div class="track" class:on={isOn}>
                    <motion.div class="puck" layout transition={row.transition} />
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .dk-demo-shell {
        width: 100%;
        height: clamp(300px, calc(100vh - 160px), 340px);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 16px;
        padding: 20px 26px;
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #0a0a0a);
    }

    .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 12px;
    }

    button {
        height: 36px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 0 12px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        color: var(--brut-ink, #0a0a0a);
        font-family: var(--brut-mono, monospace);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        cursor: pointer;
    }

    button.primary {
        border-color: var(--brut-accent, #247768);
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        color: var(--brut-accent, #247768);
    }

    .hint {
        color: var(--brut-ink-2, #4a5552);
        font-family: var(--brut-mono, monospace);
        font-size: 12px;
    }

    .stage {
        display: grid;
        align-content: center;
        gap: 22px;
        padding: 0 20px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
    }

    .row {
        display: grid;
        gap: 8px;
    }

    .label {
        color: var(--brut-ink-2, #4a5552);
        font-family: var(--brut-mono, monospace);
        font-size: 12px;
        text-transform: uppercase;
    }

    .track {
        display: flex;
        justify-content: flex-start;
        padding: 4px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #f8fcfb);
    }

    .track.on {
        justify-content: flex-end;
    }

    .track :global(.puck) {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--brut-accent, #247768);
    }
</style>
