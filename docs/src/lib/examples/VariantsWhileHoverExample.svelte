<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'

    // Live demo of #349 — variant string keys on `whileX` props.
    // The left card uses an inline keyframes object, the right card
    // pulls from the same `variants` map via `whileHover="hovered"`.
    // Both produce the same visual result; the variant-key form lets
    // you reuse the same named state across `animate`, `whileHover`,
    // and friends.

    const cardVariants = {
        hovered: { scale: 1.06, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.25)' },
        pressed: { scale: 0.96 }
    }

    const baseCard = styleString(() => ({
        width: '180px',
        height: '120px',
        borderRadius: 16,
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        color: '#fff',
        fontWeight: 600,
        fontSize: '0.95rem',
        cursor: 'pointer'
    }))
</script>

<div
    style={styleString(() => ({
        display: 'flex',
        gap: '1.25rem',
        padding: '1.5rem',
        background: 'var(--color-background-secondary)',
        borderRadius: 8,
        flexWrap: 'wrap',
        justifyContent: 'center'
    }))}
>
    <article>
        <header style="font-size: 0.78rem; opacity: 0.7; margin-bottom: 0.5rem;">
            inline form
        </header>
        <motion.div
            whileHover={{ scale: 1.06, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.25)' }}
            whileTap={{ scale: 0.96 }}
            style={baseCard}
        >
            <span>hover me</span>
            <small style="opacity: 0.75; font-weight: 400;"
                >whileHover=&#123;&#123; ... &#125;&#125;</small
            >
        </motion.div>
    </article>

    <article>
        <header style="font-size: 0.78rem; opacity: 0.7; margin-bottom: 0.5rem;">
            variant key
        </header>
        <motion.div
            variants={cardVariants}
            whileHover="hovered"
            whileTap="pressed"
            style={baseCard}
        >
            <span>hover me</span>
            <small style="opacity: 0.75; font-weight: 400;">whileHover="hovered"</small>
        </motion.div>
    </article>
</div>
