<script lang="ts">
    import { motion, styleString, type Variants } from '@humanspeak/svelte-motion'

    let isOpen = $state(false)

    const variants: Variants = {
        open: {
            opacity: 1,
            scale: 1,
            rotate: 0
        },
        closed: {
            opacity: 0.6,
            scale: 0.8,
            rotate: -5
        }
    }
</script>

<div
    style={styleString(() => ({
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        padding: '2rem',
        background: 'var(--color-background-secondary)',
        borderRadius: 8,
        margin: '2rem 0'
    }))}
>
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
        transition={{
            type: 'spring',
            stiffness: 300,
            damping: 20
        }}
        onclick={() => (isOpen = !isOpen)}
    >
        {isOpen ? 'Open' : 'Closed'}
    </motion.button>
</div>
