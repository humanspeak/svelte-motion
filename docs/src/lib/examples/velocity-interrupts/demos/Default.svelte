<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'

    // No explicit `transition`, so `whileHover` and `whileTap` use motion's
    // default springs. Because each gesture channel rides a persistent
    // MotionValue, interrupting a spring re-targets the SAME value — position
    // AND velocity carry across the handoff. Flick the pointer across the card,
    // or press while the hover spring is still settling, and the momentum keeps
    // going instead of snapping to a dead, zero-velocity start.
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// velocity interrupts</span>
            <span class="micro readout">momentum: carried</span>
        </div>

        <div class="stage">
            <motion.button
                type="button"
                aria-label="Flick across or press mid-spring to feel momentum carry"
                whileHover={{ scale: 1.4 }}
                whileTap={{ scale: 0.9 }}
                style={styleString(() => ({
                    width: '100px',
                    height: '100px',
                    border: '1px solid var(--brut-accent, #247768)',
                    backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                    boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)',
                    cursor: 'pointer'
                }))}
            ></motion.button>
        </div>

        <div class="strip-foot">
            <span class="micro">flick across · press mid-spring</span>
            <span class="micro">momentum carries</span>
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
        height: 9rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
