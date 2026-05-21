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

<!-- HUMANSPEAK: docs-kit positioning shell — stripped from the published code. -->
<div class="humanspeak-demo-shell">
    <motion.button
        style={styleString(() => ({
            padding: '1rem 2rem',
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: '1rem',
            fontWeight: 600,
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

<style>
    .humanspeak-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 220px;
    }
</style>
