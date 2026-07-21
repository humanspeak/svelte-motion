<script lang="ts">
    import { motion, styleString, type Variants } from '@humanspeak/svelte-motion'

    // Parent's `animate` doesn't just animate the parent — it cascades to
    // every descendant `motion.*` element. Each descendant looks up the
    // same variant label in its own `variants` map. Per-element
    // `transition` keeps timing independent (here: stagger per `i`).
    let isVisible = $state(false)

    const containerVariants: Variants = {
        visible: { opacity: 1 },
        hidden: { opacity: 0 }
    }

    const itemVariants: Variants = {
        visible: { opacity: 1, x: 0 },
        hidden: { opacity: 0, x: -20 }
    }

    const items = ['Item 1', 'Item 2', 'Item 3', 'Item 4']
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// variants-propagation</span>
            <span class="micro state">
                animate: "{isVisible ? 'visible' : 'hidden'}"
            </span>
        </div>

        <div class="stage">
            <motion.ul
                style={styleString(() => ({
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                }))}
                variants={containerVariants}
                initial="hidden"
                animate={isVisible ? 'visible' : 'hidden'}
            >
                {#each items as item, i (i)}
                    <motion.li
                        style={styleString(() => ({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 0.875rem',
                            fontFamily: 'var(--brut-mono, monospace)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--brut-ink, #0a0a0a)',
                            background: 'var(--brut-bg-2, #eef4f1)',
                            border: '1px solid var(--brut-rule-2, #bbc4c0)'
                        }))}
                        variants={itemVariants}
                        transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 24,
                            delay: i * 0.1
                        }}
                    >
                        <span class="dot"></span>
                        {item}
                    </motion.li>
                {/each}
            </motion.ul>
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
                {isVisible ? '– hide items' : '+ show items'}
            </motion.button>
            <span class="micro">stagger: 0.1s / cascade</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 460px;
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
        height: 12rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    .dot {
        flex: none;
        width: 8px;
        height: 8px;
        background-color: var(--brut-accent, #247768);
    }
</style>
