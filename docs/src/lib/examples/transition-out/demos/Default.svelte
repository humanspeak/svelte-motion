<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'

    let replay = $state(0)
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// transition-out</span>
            <button type="button" class="micro replay" onclick={() => (replay += 1)}>
                Replay
            </button>
        </div>

        <div class="stage">
            {#key replay}
                <!-- initial's out delays only the mount; hover end uses hover's own out -->
                <motion.div
                    class="card"
                    initial={{ scale: 0, transition: { out: { delay: 0.6 } } }}
                    animate={{ scale: 1 }}
                    whileHover={{
                        scale: 1.2,
                        transition: { duration: 0.15, out: true }
                    }}
                />
            {/key}
        </div>

        <div class="strip-foot">
            <span class="micro">initial.out: mount only</span>
            <span class="micro">hover out: true</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 360px;
    }

    .strip {
        width: 100%;
        max-width: 28rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .replay {
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: transparent;
        padding: 0.25rem 0.6rem;
        color: var(--brut-accent, #247768);
        cursor: pointer;
    }

    .strip-head,
    .strip-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .strip-foot {
        border-bottom: none;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
        padding-bottom: 0;
    }

    .stage {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 180px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
    }

    :global(.dk-demo-shell .card) {
        width: 96px;
        height: 96px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-accent, #247768);
        box-shadow: 4px 4px 0 var(--brut-rule, #d6dedb);
    }
</style>
