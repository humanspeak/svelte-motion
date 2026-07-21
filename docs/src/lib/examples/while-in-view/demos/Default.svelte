<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'

    // `whileInView` is a viewport-driven gesture state — motion runs the
    // animation each time the element enters the viewport. Pair it with
    // `viewport={{ once: true }}` to latch the animation on first entry,
    // or omit the option for a re-runs-on-every-entry feel.
    const cardStyle = styleString(() => ({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '1.25rem',
        border: '1px solid var(--brut-ink, #0a0a0a)',
        background: 'var(--brut-bg-2, #eef4f1)',
        boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)'
    }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// while-in-view</span>
            <span class="micro state">gesture: whileInView</span>
        </div>

        <div class="scroll-container">
            <p class="scroll-hint">// scroll down to trigger the cards</p>
            <div class="spacer"></div>
            <motion.div
                initial={{ opacity: 0, y: 100, scale: 0.8 }}
                whileInView={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { type: 'spring', bounce: 0.4, duration: 0.8 }
                }}
                style={cardStyle}
            >
                <span class="card-label">// re-runs on entry</span>
                <strong class="card-title">I animate every time I enter view</strong>
            </motion.div>
            <div class="spacer-bottom"></div>
            <motion.div
                initial={{ opacity: 0, y: 100, scale: 0.8 }}
                whileInView={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { type: 'spring', bounce: 0.4, duration: 0.8 }
                }}
                viewport={{ once: true, amount: 0.5, margin: '-50px' }}
                style={cardStyle}
            >
                <span class="card-label">// once: true — latched</span>
                <strong class="card-title">I animate once, then stay put</strong>
            </motion.div>
            <div class="spacer-bottom"></div>
            <p class="scroll-hint">// scroll back up — only the first card re-animates</p>
            <div class="spacer-end"></div>
        </div>

        <div class="strip-foot">
            <span class="micro">observer: intersection</span>
            <span class="micro">spring: bounce 0.4</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 520px;
    }

    .strip {
        width: 100%;
        max-width: 480px;
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

    .scroll-container {
        width: 100%;
        height: 340px;
        overflow-y: auto;
        border: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding: 1rem;
    }

    .scroll-hint {
        text-align: center;
        margin: 1rem 0;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .card-label {
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-accent, #247768);
    }

    .card-title {
        font-size: 0.9375rem;
        font-weight: 700;
        color: var(--brut-ink, #0a0a0a);
    }

    .spacer {
        height: 350px;
    }

    .spacer-bottom {
        height: 300px;
    }

    .spacer-end {
        height: 100px;
    }
</style>
