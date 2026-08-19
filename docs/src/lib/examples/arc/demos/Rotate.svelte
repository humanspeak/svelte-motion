<script lang="ts">
    import { arc, motion } from '@humanspeak/svelte-motion'

    let right = $state(false)
    const path = arc({ strength: 0.8, rotate: true })
    const transition = { duration: 1, ease: 'easeInOut' as const, path }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <header>
            <span class="micro">// tangent following</span>
            <span class="micro readout">rotate: true</span>
        </header>

        <button
            class="stage"
            type="button"
            aria-label="Move the arrow along an arc"
            onclick={() => (right = !right)}
        >
            <motion.div
                class="arrow"
                initial={{ x: 0, y: 0 }}
                animate={{ x: right ? 260 : 0, y: 0 }}
                {transition}
            >
                ➜
            </motion.div>
        </button>

        <footer>
            <span class="micro">click the stage</span>
            <span class="micro">pathRotation + rotate</span>
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
        position: relative;
        height: 180px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
        cursor: pointer;
    }

    :global(.arrow) {
        position: absolute;
        top: 62px;
        left: 24px;
        display: grid;
        width: 52px;
        height: 52px;
        place-items: center;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-accent, #247768);
        color: white;
        font-size: 2rem;
        line-height: 1;
    }
</style>
