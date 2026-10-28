<script lang="ts">
    import { Maximize2 } from '@lucide/svelte'
    import { motion } from '@humanspeak/svelte-motion'

    // `layoutAnchor` picks the point on the parent a child's relative layout
    // projection is anchored to. The child's own layout animation is delayed,
    // so for the first half of each resize it only follows its parent: with
    // the centre anchor it stays centred, with the default top-left it drifts.
    type Anchor = { label: string; value: { x: number; y: number } | false | undefined }
    const anchors: Anchor[] = [
        { label: 'default (top-left)', value: undefined },
        { label: '{ x: 0.5, y: 0.5 }', value: { x: 0.5, y: 0.5 } },
        { label: 'false', value: false }
    ]

    let expanded = $state(false)
    let anchorIndex = $state(1)
    const anchor = $derived(anchors[anchorIndex].value)

    const parentTransition = { duration: 1, ease: 'linear' } as const
    const childTransition = { duration: 1, ease: 'linear', delay: 0.5 } as const
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="toolbar" aria-label="layoutAnchor controls">
        {#each anchors as option, i (option.label)}
            <button
                type="button"
                class:active={anchorIndex === i}
                aria-pressed={anchorIndex === i}
                onclick={() => (anchorIndex = i)}
            >
                {option.label}
            </button>
        {/each}
        <button type="button" class="primary" onclick={() => (expanded = !expanded)}>
            <Maximize2 size={15} />
            {expanded ? 'Shrink' : 'Grow'}
        </button>
    </div>

    <div class="stage">
        <motion.div
            class="parent"
            layout
            transition={parentTransition}
            style="width: {expanded ? 320 : 160}px; height: {expanded ? 240 : 120}px"
        >
            <motion.div class="child" layout layoutAnchor={anchor} transition={childTransition} />
        </motion.div>
    </div>
</div>

<style>
    .dk-demo-shell {
        width: 100%;
        height: clamp(380px, calc(100vh - 160px), 440px);
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

    .stage {
        display: grid;
        place-items: center;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
    }

    .stage :global(.parent) {
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px dashed var(--brut-ink-2, #4a5552);
    }

    .stage :global(.child) {
        width: 48px;
        height: 48px;
        background: var(--brut-accent, #247768);
    }
</style>
