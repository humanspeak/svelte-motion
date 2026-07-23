<script lang="ts">
    import { LazyMotion, domAnimation, m, motion, styleString } from '@humanspeak/svelte-motion'

    let replayId = $state(0)
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// lazy motion</span>
            <span class="micro readout">features: domAnimation</span>
        </div>

        <div class="stage">
            <LazyMotion features={domAnimation}>
                {#key replayId}
                    <m.button
                        initial={{ opacity: 0, y: 24, scale: 0.94 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        whileHover={{ y: -4, scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        style={styleString(() => ({
                            fontFamily: 'var(--brut-mono, monospace)',
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            border: '1px solid var(--brut-ink, #0a0a0a)',
                            backgroundColor: 'var(--brut-bg-2, #eef4f1)',
                            color: 'var(--brut-ink, #0a0a0a)',
                            padding: '0.75rem 1.25rem',
                            boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)',
                            cursor: 'pointer'
                        }))}
                    >
                        Lazy m.button
                    </m.button>
                {/key}
            </LazyMotion>
        </div>

        <div class="strip-foot">
            <motion.button
                type="button"
                onclick={() => (replayId += 1)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={styleString(() => ({
                    fontFamily: 'var(--brut-mono, monospace)',
                    fontSize: '0.6875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    border: '1px solid var(--brut-accent, #247768)',
                    backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                    color: 'var(--brut-accent, #247768)',
                    padding: '0.5rem 0.875rem',
                    cursor: 'pointer'
                }))}
            >
                ↻ replay
            </motion.button>
            <span class="micro">lazy-loaded feature bundle</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 260px;
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
        height: 8rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
