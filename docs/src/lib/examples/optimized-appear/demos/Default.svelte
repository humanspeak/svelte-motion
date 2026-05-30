<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <motion.article
        class="appear-card"
        initial={{ opacity: 0, y: 32, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
        <span class="rail"></span>
        <h3>Hydrated cleanly</h3>
        <p>Opacity and transform start before the component runtime claims the element.</p>
    </motion.article>
</div>

<style>
    .dk-demo-shell {
        min-height: 300px;
        display: grid;
        place-items: center;
        gap: 1rem;
        padding: 2rem;
    }

    :global(.appear-card) {
        width: min(100%, 360px);
        border: 1px solid rgba(125, 211, 252, 0.35);
        border-radius: 8px;
        padding: 1.4rem;
        background: linear-gradient(135deg, rgba(8, 47, 73, 0.92), rgba(20, 83, 45, 0.74));
        color: white;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
    }

    :global(.appear-card h3) {
        margin: 1rem 0 0.35rem;
        font-size: 1.25rem;
    }

    :global(.appear-card p) {
        margin: 0;
        color: rgba(255, 255, 255, 0.78);
        line-height: 1.55;
    }

    .rail {
        display: block;
        width: 76px;
        height: 6px;
        border-radius: 999px;
        background: #7dd3fc;
    }
</style>
