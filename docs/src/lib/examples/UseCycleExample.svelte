<script lang="ts">
    import { motion, useCycle } from '@humanspeak/svelte-motion'

    const variants = {
        rest: {
            x: 0,
            rotate: 0,
            scale: 1,
            backgroundColor: '#667eea'
        },
        nudge: {
            x: 90,
            rotate: 8,
            scale: 1.05,
            backgroundColor: '#7c3aed'
        },
        flip: {
            x: 90,
            rotate: 188,
            scale: 1.1,
            backgroundColor: '#db2777'
        },
        spin: {
            x: 0,
            rotate: 540,
            scale: 1,
            backgroundColor: '#f59e0b'
        }
    } as const

    const labels = ['rest', 'nudge', 'flip', 'spin'] as const
    const [variant, cycle] = useCycle<keyof typeof variants>(...labels)
</script>

<div class="flex min-h-[420px] flex-col items-center justify-center gap-8 p-8">
    <div class="track">
        <motion.div
            class="cycle-card"
            {variants}
            animate={$variant}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        >
            {$variant}
        </motion.div>
    </div>

    <div class="flex flex-wrap items-center justify-center gap-2">
        <button type="button" class="primary" onclick={() => cycle()}>cycle()</button>
        {#each labels as label, i (label)}
            <button
                type="button"
                class="ghost"
                class:active={$variant === label}
                onclick={() => cycle(i)}
            >
                cycle({i})
            </button>
        {/each}
    </div>
</div>

<style>
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
        color: rgba(255, 255, 255, 0.85);
        border-color: rgba(255, 255, 255, 0.25);
    }

    .ghost:hover {
        background: rgba(255, 255, 255, 0.08);
    }

    .ghost.active {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.5);
    }
</style>
