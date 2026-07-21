<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'

    // `animate={{ rotate: 360 }}` tweens the transform's rotate value
    // from its current state to 360°. Bumping the key remounts the
    // element so the rotation plays again.
    let replayId = $state(0)
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// rotate</span>
            <span class="micro counter">replay {String(replayId).padStart(2, '0')}</span>
        </div>

        <div class="stage">
            {#key replayId}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1 }}
                    style={styleString(() => ({
                        width: '96px',
                        height: '96px',
                        display: 'grid',
                        placeItems: 'start center',
                        paddingTop: '6px',
                        border: '1px solid var(--brut-ink, #0a0a0a)',
                        backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                        boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)'
                    }))}
                >
                    <span class="tick"></span>
                </motion.div>
            {/key}
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
            <span class="micro">rotate: 0 → 360° / 1s</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 280px;
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

    .counter {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
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
        height: 9rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .tick {
        width: 14px;
        height: 14px;
        background: var(--brut-accent, #247768);
    }
</style>
