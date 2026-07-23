<script lang="ts">
    import { motion, styleString, type Variants } from '@humanspeak/svelte-motion'

    // A `variants` map gives you named animation states. Pass a label
    // string to `animate` and motion looks it up in the map and tweens
    // there — handy for binary toggles like open/closed.
    let isOpen = $state(false)

    const variants: Variants = {
        open: { opacity: 1, scale: 1, rotate: 0 },
        closed: { opacity: 0.6, scale: 0.8, rotate: -5 }
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// variants-basic</span>
            <span class="micro state">
                animate: "{isOpen ? 'open' : 'closed'}"
            </span>
        </div>

        <div class="stage">
            <motion.button
                style={styleString(() => ({
                    fontFamily: 'var(--brut-mono, monospace)',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '1rem 2rem',
                    border: '1px solid var(--brut-accent, #247768)',
                    backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                    color: 'var(--brut-accent, #247768)',
                    cursor: 'pointer'
                }))}
                {variants}
                initial="closed"
                animate={isOpen ? 'open' : 'closed'}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                onclick={() => (isOpen = !isOpen)}
            >
                {isOpen ? 'Open' : 'Closed'}
            </motion.button>
        </div>

        <div class="strip-foot">
            <span class="micro">spring: 300 / 20</span>
            <span class="micro">tap to toggle label</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 300px;
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
        height: 8rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
