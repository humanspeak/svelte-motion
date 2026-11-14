<script lang="ts">
    import { MoveHorizontal } from '@lucide/svelte'
    import { motion } from '@humanspeak/svelte-motion'

    // Motion 14.13: `mass: "auto"` sizes a layout spring's mass from the
    // element (a 300 px square has mass 1, clamped to 0.25..2). Both tiles
    // move by the same distance on the same spring. With "auto" the large
    // tile is heavier: it lags and settles later while the small one snaps
    // over. With the default mass of 1 they move in lockstep.
    const tiles = [
        { id: 'small', size: 40 },
        { id: 'large', size: 200 }
    ] as const

    const spring = { type: 'spring', visualDuration: 0.45, bounce: 0 } as const

    let isAuto = $state(true)
    let isRight = $state(false)
    const transition = $derived(isAuto ? { ...spring, mass: 'auto' as const } : spring)

    // How long each tile's last layout animation took, in milliseconds.
    const startedAt: Record<string, number> = {}
    const took = $state<Record<string, number | null>>({ small: null, large: null })
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="toolbar" aria-label="mass controls">
        <button
            type="button"
            class:active={!isAuto}
            aria-pressed={!isAuto}
            onclick={() => (isAuto = false)}
        >
            mass: 1
        </button>
        <button
            type="button"
            class:active={isAuto}
            aria-pressed={isAuto}
            onclick={() => (isAuto = true)}
        >
            mass: 'auto'
        </button>
        <button type="button" class="primary" onclick={() => (isRight = !isRight)}>
            <MoveHorizontal size={15} />
            Move
        </button>
        <span class="hint" data-testid="auto-mass-readout">
            {#each tiles as tile (tile.id)}
                <span>{tile.id}: {took[tile.id] === null ? '-' : `${took[tile.id]} ms`}</span>
            {/each}
        </span>
    </div>

    <div class="stage" class:right={isRight}>
        {#each tiles as tile (tile.id)}
            <motion.div
                class="tile"
                data-tile={tile.id}
                layout
                {transition}
                style="width: {tile.size}px; height: {tile.size}px"
                onLayoutAnimationStart={() => {
                    startedAt[tile.id] = performance.now()
                    took[tile.id] = null
                }}
                onLayoutAnimationComplete={() => {
                    took[tile.id] = Math.round(performance.now() - startedAt[tile.id])
                }}
            ></motion.div>
        {/each}
    </div>
</div>

<style>
    .dk-demo-shell {
        width: 100%;
        height: clamp(380px, calc(100vh - 160px), 420px);
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
        justify-content: center;
        gap: 8px;
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
        cursor: pointer;
    }

    button.active {
        border-color: var(--brut-ink, #0a0a0a);
        background: var(--brut-ink, #0a0a0a);
        color: var(--brut-accent-ink, #f8fcfb);
    }

    button.primary {
        border-color: var(--brut-accent, #247768);
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        color: var(--brut-accent, #247768);
    }

    .hint {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        color: var(--brut-ink-2, #4a5552);
        font-family: var(--brut-mono, monospace);
        font-size: 12px;
    }

    .stage {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 16px;
        padding: 0 16px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
    }

    .stage.right {
        align-items: flex-end;
    }

    .stage :global(.tile) {
        flex: none;
        background: var(--brut-accent, #247768);
    }
</style>
