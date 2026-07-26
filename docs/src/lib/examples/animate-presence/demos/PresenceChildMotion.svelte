<script lang="ts">
    import { AnimatePresence, PresenceChild, motion, styleString } from '@humanspeak/svelte-motion'

    let present = $state(true)
    let completed = $state(0)
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="demo">
        <div class="stage">
            <AnimatePresence onExitComplete={() => (completed += 1)}>
                <PresenceChild {present}>
                    <motion.div
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -18, scale: 0.92 }}
                        transition={{ duration: 0.45, ease: 'easeInOut' }}
                        style={styleString(() => ({
                            width: 210,
                            border: '1px solid var(--brut-accent, #247768)',
                            backgroundColor: 'var(--brut-bg-2, #eef4f1)',
                            color: 'var(--brut-ink, #0a0a0a)',
                            padding: 18,
                            boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)'
                        }))}
                    >
                        <p class="label">real DOM node</p>
                        <strong>PresenceChild + motion.*</strong>
                        <p class="detail">Exit completes before this node is removed.</p>
                    </motion.div>
                </PresenceChild>
            </AnimatePresence>
        </div>

        <div class="controls">
            <motion.button
                onclick={() => (present = !present)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                style={styleString(() => ({
                    border: '1px solid var(--brut-accent, #247768)',
                    backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                    color: 'var(--brut-accent, #247768)',
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer'
                }))}
            >
                {present ? 'run real-node exit' : 'mount again'}
            </motion.button>
            <span>completed: {completed}</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        min-height: 340px;
        display: grid;
        place-items: center;
        padding: 1.5rem;
    }

    .demo {
        width: min(100%, 420px);
    }

    .stage {
        height: 190px;
        display: grid;
        place-items: center;
        border: 1px dashed var(--brut-rule-2, #bbc4c0);
    }

    .label,
    .detail {
        margin: 0;
        font-family: var(--brut-mono, monospace);
    }

    .label {
        color: var(--brut-accent, #247768);
        font-size: 0.625rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }

    strong {
        display: block;
        margin-top: 0.5rem;
    }

    .detail {
        margin-top: 0.35rem;
        color: var(--brut-ink-2, #525252);
        font-size: 0.6875rem;
    }

    .controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-top: 0.75rem;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
    }
</style>
