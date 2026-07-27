<script lang="ts">
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'

    let cloneVisible = $state(true)
    let ownedVisible = $state(true)

    const exit = { opacity: 0, y: -22, scale: 0.92 }
    const transition = { duration: 0.7, ease: 'linear' as const }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="comparison">
        <div class="prompt">
            <strong>Try the decisive test</strong>
            <span>Click each lane’s button twice quickly.</span>
        </div>

        <div class="lanes">
            <section class="lane clone">
                <header>
                    <span>Existing API</span>
                    <h3>Clone fallback</h3>
                </header>
                <div class="stage">
                    <AnimatePresence>
                        {#if cloneVisible}
                            <motion.div
                                key="clone-card"
                                class="card"
                                initial={{ opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                {exit}
                                {transition}
                            >
                                <strong>Detached ghost</strong>
                                <input aria-label="Clone path state" value="edit me" />
                            </motion.div>
                        {/if}
                    </AnimatePresence>
                </div>
                <button onclick={() => (cloneVisible = !cloneVisible)}>
                    {cloneVisible ? 'exit clone path' : 'mount new node'}
                </button>
                <p>Rapid re-entry creates a new node while the old clone keeps exiting.</p>
            </section>

            <section class="lane owned">
                <header>
                    <span>Owned API</span>
                    <h3>Real node</h3>
                </header>
                <div class="stage">
                    <AnimatePresence present={ownedVisible}>
                        {#snippet child()}
                            <motion.div
                                class="card"
                                initial={{ opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                {exit}
                                {transition}
                            >
                                <strong>Original instance</strong>
                                <input aria-label="Owned path state" value="edit me" />
                            </motion.div>
                        {/snippet}
                    </AnimatePresence>
                </div>
                <button onclick={() => (ownedVisible = !ownedVisible)}>
                    {ownedVisible ? 'exit real node' : 'reverse / mount'}
                </button>
                <p>Rapid re-entry reverses the same node and preserves its live state.</p>
            </section>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        min-height: 430px;
        display: grid;
        place-items: center;
        padding: 1.5rem;
    }

    .comparison {
        width: min(100%, 760px);
    }

    .prompt {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        border-left: 3px solid #d6a500;
        background: color-mix(in srgb, #d6a500 10%, transparent);
        padding: 0.75rem 1rem;
        font-family: var(--brut-mono, monospace);
        font-size: 0.7rem;
    }

    .prompt strong {
        color: #9a7200;
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    .lanes {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
        margin-top: 1rem;
    }

    .lane {
        min-width: 0;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        padding: 0.875rem;
    }

    .lane header span {
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .clone header span,
    .clone h3 {
        color: #a24755;
    }

    .owned header span,
    .owned h3 {
        color: var(--brut-accent, #247768);
    }

    h3 {
        margin: 0.2rem 0 0;
        font-size: 1rem;
    }

    .stage {
        height: 150px;
        display: grid;
        place-items: center;
        margin: 0.75rem 0;
        border: 1px dashed var(--brut-rule-2, #bbc4c0);
        overflow: hidden;
    }

    :global(.card) {
        width: min(180px, calc(100% - 1.5rem));
        display: grid;
        gap: 0.625rem;
        border: 1px solid currentColor;
        background: var(--brut-bg-2, #eef4f1);
        padding: 0.75rem;
        box-shadow: 5px 5px 0 var(--brut-rule, #d6dedb);
    }

    :global(.clone .card) {
        color: #a24755;
    }

    :global(.owned .card) {
        color: var(--brut-accent, #247768);
    }

    input {
        min-width: 0;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #fff);
        color: var(--brut-ink, #0a0a0a);
        padding: 0.4rem;
        font: inherit;
    }

    button {
        width: 100%;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: transparent;
        color: var(--brut-ink, #0a0a0a);
        padding: 0.5rem;
        cursor: pointer;
    }

    .lane > p {
        min-height: 2.7rem;
        margin: 0.625rem 0 0;
        color: var(--brut-ink-2, #525252);
        font-size: 0.7rem;
        line-height: 1.45;
    }

    @media (max-width: 620px) {
        .lanes {
            grid-template-columns: 1fr;
        }

        .prompt {
            align-items: flex-start;
            flex-direction: column;
        }
    }
</style>
