<script lang="ts">
    import { motion, styleString, type Variants } from '@humanspeak/svelte-motion'

    // The named states live once on the `variants` map and any number of
    // gesture props can pull from them by key. Same animation reused across
    // `whileHover`, `whileTap` (and `whileFocus` / `whileDrag` / `whileInView`).
    const cardVariants: Variants = {
        hovered: { scale: 1.06, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.25)' },
        pressed: { scale: 0.96 }
    }
</script>

<!-- dk-strip: positioning shell — see InlineForm.svelte's note for the
     full why; stripped from the published manifest. -->
<div class="dk-demo-shell">
    <motion.div
        variants={cardVariants}
        whileHover="hovered"
        whileTap="pressed"
        style={styleString(() => ({
            width: '200px',
            height: '120px',
            borderRadius: 16,
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer'
        }))}
    >
        <span>hover or tap me</span>
        <small style="opacity: 0.75; font-weight: 400;">whileHover="hovered"</small>
    </motion.div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 240px;
    }
</style>
