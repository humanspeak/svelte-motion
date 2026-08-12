<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'

    const lines = [
        'Filter, clip-path, and color now ride the appear path.',
        'Each line starts blurred inside the SSR payload.',
        'Hydration adopts the animation mid-flight — no snap, no pop.'
    ]
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// blur fade</span>
            <span class="micro readout">filter: WAAPI</span>
        </div>

        <div class="stage">
            <motion.h3
                initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
                Blur fade
            </motion.h3>
            {#each lines as line, i (line)}
                <motion.p
                    initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{
                        duration: 0.5,
                        delay: 0.15 * (i + 1),
                        ease: [0.16, 1, 0.3, 1]
                    }}
                    style={styleString(() => ({
                        borderLeft: '3px solid var(--brut-accent, #247768)',
                        paddingLeft: '0.75rem'
                    }))}
                >
                    {line}
                </motion.p>
            {/each}
        </div>

        <div class="strip-foot">
            <span class="micro">blur(8px) → blur(0px)</span>
            <span class="micro">stagger: 150ms</span>
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
        flex-direction: column;
        gap: 0.85rem;
        padding: 0.5rem 0;
    }

    .stage :global(h3) {
        margin: 0;
        font-family: var(--brut-mono, monospace);
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--brut-ink, #0a0a0a);
    }

    .stage :global(p) {
        margin: 0;
        color: var(--brut-ink-2, #525252);
        line-height: 1.55;
    }
</style>
