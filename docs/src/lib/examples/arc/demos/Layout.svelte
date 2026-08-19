<script lang="ts">
    import { arc, motion } from '@humanspeak/svelte-motion'

    let right = $state(false)
    const path = arc({ strength: 0.5 })
    const transition = { layout: { duration: 0.8, ease: 'easeInOut' as const, path } }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <header>
            <span class="micro">// shared layout</span>
            <span class="micro readout">layoutId="arc-bubble"</span>
        </header>

        <button
            class="stage"
            type="button"
            aria-label="Move the shared bubble"
            onclick={() => (right = !right)}
        >
            <span class="slot left">
                {#if !right}
                    <motion.span layoutId="arc-bubble" class="bubble" {transition} />
                {/if}
            </span>
            <span class="slot right">
                {#if right}
                    <motion.span layoutId="arc-bubble" class="bubble" {transition} />
                {/if}
            </span>
        </button>

        <footer>
            <span class="micro">click to swap slots</span>
            <span class="micro">transition.layout.path</span>
        </footer>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 280px;
        padding: 1.5rem;
    }

    .strip {
        display: flex;
        width: 100%;
        max-width: 390px;
        flex-direction: column;
        gap: 0.75rem;
    }

    header,
    footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    footer {
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        border-bottom: 0;
        padding-top: 0.5rem;
        padding-bottom: 0;
    }

    .micro {
        color: var(--brut-ink-3, #6f7975);
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .readout {
        color: var(--brut-accent, #247768);
        text-transform: none;
    }

    .stage {
        display: grid;
        height: 200px;
        grid-template-columns: 1fr 1fr;
        gap: 120px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        padding: 20px;
        background: var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
        cursor: pointer;
    }

    .slot {
        display: flex;
        align-items: center;
        border: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding: 8px;
    }

    .slot.left {
        justify-content: flex-start;
    }

    .slot.right {
        justify-content: flex-end;
    }

    :global(.bubble) {
        display: block;
        width: 52px;
        height: 52px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        border-radius: 999px;
        background: var(--brut-accent, #247768);
    }
</style>
