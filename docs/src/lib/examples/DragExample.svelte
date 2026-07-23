<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'
</script>

<div class="drag-example">
    <p class="micro">// drag the box around</p>
    <motion.div
        drag
        whileHover={{ scale: 1.03 }}
        whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={styleString(() => ({
            width: '6rem',
            height: '6rem',
            cursor: 'grab',
            touchAction: 'none',
            backgroundColor: 'var(--brut-accent, #247768)',
            border: '1px solid var(--brut-ink, #0a0a0a)',
            boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)'
        }))}
    ></motion.div>
</div>

<style>
    .drag-example {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
    }

    .micro {
        margin: 0;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }
</style>
