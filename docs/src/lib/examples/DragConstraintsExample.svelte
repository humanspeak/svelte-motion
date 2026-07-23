<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'

    let bounds: HTMLElement | null = null
</script>

<div class="drag-example">
    <p class="micro">// constrained to the dashed area</p>
    <div bind:this={bounds} class="bounds">
        <motion.div
            drag
            dragConstraints={bounds}
            whileHover={{ scale: 1.03 }}
            whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={styleString(() => ({
                width: '4rem',
                height: '4rem',
                cursor: 'grab',
                touchAction: 'none',
                backgroundColor: 'var(--brut-accent, #247768)',
                border: '1px solid var(--brut-ink, #0a0a0a)',
                boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)'
            }))}
        ></motion.div>
    </div>
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

    .bounds {
        position: relative;
        display: grid;
        place-items: center;
        width: 14rem;
        height: 14rem;
        border: 1px dashed var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
    }
</style>
