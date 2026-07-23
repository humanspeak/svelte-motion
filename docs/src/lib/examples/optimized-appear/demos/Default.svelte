<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// optimized appear</span>
            <span class="micro readout">hydration: clean</span>
        </div>

        <div class="stage">
            <motion.article
                initial={{ opacity: 0, y: 32, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                style={styleString(() => ({
                    width: 'min(100%, 360px)',
                    border: '1px solid var(--brut-ink, #0a0a0a)',
                    padding: '1.4rem',
                    backgroundColor: 'var(--brut-bg-2, #eef4f1)',
                    boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)'
                }))}
            >
                <span class="rail"></span>
                <h3>Hydrated cleanly</h3>
                <p>Opacity and transform start before the component runtime claims the element.</p>
            </motion.article>
        </div>

        <div class="strip-foot">
            <span class="micro">initial → animate on mount</span>
            <span class="micro">duration: 800ms</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        min-height: 300px;
        display: grid;
        place-items: center;
        padding: 2rem;
    }

    .strip {
        width: 100%;
        max-width: 420px;
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

    .readout {
        color: var(--brut-accent, #247768);
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
        padding: 0.5rem 0;
    }

    .rail {
        display: block;
        width: 76px;
        height: 6px;
        background: var(--brut-accent, #247768);
    }

    h3 {
        margin: 1rem 0 0.35rem;
        font-family: var(--brut-mono, monospace);
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--brut-ink, #0a0a0a);
    }

    p {
        margin: 0;
        color: var(--brut-ink-2, #525252);
        line-height: 1.55;
    }
</style>
