<script lang="ts">
    import { motion, styleString, type Variants } from '@humanspeak/svelte-motion'

    // The named states live once on the `variants` map and any number of
    // gesture props can pull from them by key. Same animation reused across
    // `whileHover`, `whileTap` (and `whileFocus` / `whileDrag` / `whileInView`).
    const cardVariants: Variants = {
        hovered: { scale: 1.06, y: -4 },
        pressed: { scale: 0.96, y: 0 }
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// variant key</span>
            <span class="micro readout">whileHover="hovered"</span>
        </div>

        <div class="stage">
            <motion.div
                variants={cardVariants}
                whileHover="hovered"
                whileTap="pressed"
                style={styleString(() => ({
                    width: '200px',
                    height: '120px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid var(--brut-accent, #247768)',
                    backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                    boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)',
                    color: 'var(--brut-ink, #171717)',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                }))}
            >
                <span>hover or tap me</span>
                <small class="micro">variants map</small>
            </motion.div>
        </div>

        <div class="strip-foot">
            <span class="micro">hovered · pressed</span>
            <span class="micro">one map, any gesture</span>
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
        text-transform: none;
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
        height: 11rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
