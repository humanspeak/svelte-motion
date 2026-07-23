<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'

    // `whileHover` and `whileTap` declare temporary animation states that
    // motion blends in while a pointer is over (or pressing) the element.
    // Releasing the gesture animates back to the resting `animate` state.
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// hover and tap</span>
            <span class="micro readout">gesture: pointer</span>
        </div>

        <div class="stage">
            <motion.button
                type="button"
                aria-label="Hover or tap to scale"
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.8 }}
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
            <span class="micro">hover · tap</span>
            <span class="micro">hover: 1.2 / tap: 0.8</span>
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
