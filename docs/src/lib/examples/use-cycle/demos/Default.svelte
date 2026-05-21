<script lang="ts">
    import { motion, useCycle } from '@humanspeak/svelte-motion'

    // `useCycle(...labels)` returns `{ current, cycle }`. `.cycle()` advances
    // through the labels in order, `.cycle(i)` jumps to a specific index, and
    // `.current` is the live value (reactive via Svelte 5 `$state`). Pair it
    // with a `variants` map keyed by the same labels and you have a tiny
    // state machine with declarative animation per state.
    const variants = {
        rest: { x: 0, rotate: 0, scale: 1, backgroundColor: '#667eea' },
        nudge: { x: 90, rotate: 8, scale: 1.05, backgroundColor: '#7c3aed' },
        flip: { x: 90, rotate: 188, scale: 1.1, backgroundColor: '#db2777' },
        spin: { x: 0, rotate: 540, scale: 1, backgroundColor: '#f59e0b' }
    } as const

    const labels = ['rest', 'nudge', 'flip', 'spin'] as const
    const variant = useCycle<keyof typeof variants>(...labels)
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="track">
        <motion.div
            class="cycle-card"
            {variants}
            animate={variant.current}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        >
            {variant.current}
        </motion.div>
    </div>

    <div class="controls">
        <div class="control-cell">
            <button type="button" class="primary" onclick={() => variant.cycle()}> cycle() </button>
            <span class="control-caption">advance</span>
        </div>
        {#each labels as label, i (label)}
            <div class="control-cell">
                <button
                    type="button"
                    class="ghost"
                    class:active={variant.current === label}
                    onclick={() => variant.cycle(i)}
                >
                    cycle({i})
                </button>
                <span class="control-caption" class:active-caption={variant.current === label}>
                    {label}
                </span>
            </div>
        {/each}
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2rem;
        padding: 2rem;
        min-height: 420px;
    }

    .track {
        width: 280px;
        display: flex;
        align-items: center;
        justify-content: flex-start;
    }

    .track :global(.cycle-card) {
        width: 96px;
        height: 96px;
        border-radius: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        color: white;
        text-transform: capitalize;
        box-shadow: 0 12px 32px rgba(15, 15, 35, 0.35);
        will-change: transform;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: center;
        gap: 12px 10px;
    }

    .control-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }

    .control-caption {
        font-size: 11px;
        font-family: ui-monospace, monospace;
        text-transform: lowercase;
        letter-spacing: 0.04em;
        color: #6b7280;
    }
    .control-caption.active-caption {
        color: #1d4ed8;
        font-weight: 600;
    }
    :global(.dark) .control-caption {
        color: rgba(255, 255, 255, 0.55);
    }
    :global(.dark) .control-caption.active-caption {
        color: rgba(255, 255, 255, 0.95);
    }

    .primary,
    .ghost {
        font-size: 13px;
        font-weight: 500;
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid transparent;
        cursor: pointer;
        transition:
            background-color 120ms ease,
            border-color 120ms ease,
            color 120ms ease;
    }

    .primary {
        background: #2563eb;
        color: white;
    }

    .primary:hover {
        background: #1d4ed8;
    }

    .ghost {
        background: transparent;
        color: #4b5563;
        border-color: rgba(0, 0, 0, 0.2);
    }

    .ghost:hover {
        background: rgba(0, 0, 0, 0.04);
    }

    .ghost.active {
        background: rgba(37, 99, 235, 0.1);
        border-color: #2563eb;
        color: #1d4ed8;
    }

    :global(.dark) .ghost {
        color: rgba(255, 255, 255, 0.85);
        border-color: rgba(255, 255, 255, 0.25);
    }

    :global(.dark) .ghost:hover {
        background: rgba(255, 255, 255, 0.08);
    }

    :global(.dark) .ghost.active {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.5);
        color: white;
    }
</style>
