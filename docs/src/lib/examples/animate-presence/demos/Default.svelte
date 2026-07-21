<script lang="ts">
    import { AnimatePresence, MotionConfig, motion, styleString } from '@humanspeak/svelte-motion'

    // A `motion.*` element inside `<AnimatePresence>` with an `exit` prop runs
    // that animation when the element is removed from the DOM. Toggle the
    // unit — the card scales + fades in on mount, then runs its `exit`
    // (scale + fade out) when it leaves, all on the same spring.
    let isVisible = $state(true)
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <MotionConfig transition={{ duration: 0.6 }}>
        <div class="strip">
            <div class="strip-head">
                <span class="micro">// presence</span>
                <span class="micro state">
                    state: {isVisible ? 'mounted' : 'unmounted'}
                </span>
            </div>

            <!-- Fixed-height stage so the footer never moves as the unit enters/exits. -->
            <div class="stage">
                <AnimatePresence>
                    {#if isVisible}
                        <motion.div
                            key="unit"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            style={styleString(() => ({
                                transformOrigin: 'center'
                            }))}
                        >
                            <article class="unit">
                                <header class="unit-head">
                                    <motion.span
                                        animate={{ opacity: [1, 0.35, 1] }}
                                        transition={{
                                            duration: 1.6,
                                            repeat: Infinity,
                                            ease: 'easeInOut'
                                        }}
                                        style={styleString(() => ({
                                            flex: 'none',
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            backgroundColor: 'var(--brut-accent, #247768)'
                                        }))}
                                    ></motion.span>
                                    <span class="unit-name">unit.01</span>
                                </header>
                                <dl class="unit-meta">
                                    <div>
                                        <dt>enter</dt>
                                        <dd>scale 0 → 1</dd>
                                    </div>
                                    <div>
                                        <dt>exit</dt>
                                        <dd>scale 1 → 0</dd>
                                    </div>
                                </dl>
                            </article>
                        </motion.div>
                    {/if}
                </AnimatePresence>
            </div>

            <div class="strip-foot">
                <motion.button
                    onclick={() => (isVisible = !isVisible)}
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
                    {isVisible ? '– unmount unit' : '+ mount unit'}
                </motion.button>
                <span class="micro">spring: 300 / 25</span>
            </div>
        </div>
    </MotionConfig>
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

    .state {
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
        height: 9rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .unit {
        width: 13rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        padding: 0.875rem;
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }

    .unit-head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .unit-name {
        font-family: var(--brut-mono, monospace);
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--brut-ink, #0a0a0a);
    }

    .unit-meta {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin: 0;
    }

    .unit-meta div {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .unit-meta dt {
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .unit-meta dd {
        margin: 0;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        color: var(--brut-ink-2, #525252);
    }
</style>
