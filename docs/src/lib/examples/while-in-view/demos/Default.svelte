<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'

    // `whileInView` is a viewport-driven gesture state — motion runs the
    // animation each time the element enters the viewport. Pair it with
    // `viewport={{ once: true }}` to latch the animation on first entry,
    // or omit the option for a re-runs-on-every-entry feel.
</script>

<!-- HUMANSPEAK: docs-kit positioning shell — stripped from the published code. -->
<div class="humanspeak-demo-shell">
    <div class="scroll-container">
        <p class="scroll-hint">Scroll down to see the animations</p>
        <div class="spacer"></div>
        <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            whileInView={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { type: 'spring', bounce: 0.4, duration: 0.8 }
            }}
            style="display: flex; align-items: center; justify-content: center; padding: 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white; font-weight: 600; text-align: center; font-size: 1.25rem;"
        >
            I animate every time I enter view
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
            style="display: flex; align-items: center; justify-content: center; padding: 2rem; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; color: white; font-weight: 600; text-align: center; font-size: 1.25rem;"
        >
            I animate once — viewport=&lbrace; once: true, amount: 0.5, margin: '-50px' &rbrace;
        </motion.div>
        <div class="spacer-bottom"></div>
        <p class="scroll-hint">Scroll back up — only the first card re-animates</p>
        <div class="spacer-end"></div>
    </div>
</div>

<style>
    .humanspeak-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 480px;
    }

    .scroll-container {
        width: 100%;
        max-width: 480px;
        height: 400px;
        overflow-y: auto;
        border: 1px solid var(--color-border, #333);
        border-radius: 8px;
        padding: 1rem;
    }

    .scroll-hint {
        text-align: center;
        color: var(--color-text-muted, #888);
        margin: 1rem 0;
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
