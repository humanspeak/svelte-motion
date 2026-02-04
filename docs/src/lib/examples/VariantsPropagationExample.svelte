<script lang="ts">
    import { motion, styleString, type Variants } from '@humanspeak/svelte-motion'

    let isVisible = $state(false)

    const containerVariants: Variants = {
        visible: {
            opacity: 1
        },
        hidden: {
            opacity: 0
        }
    }

    const itemVariants: Variants = {
        visible: {
            opacity: 1,
            x: 0
        },
        hidden: {
            opacity: 0,
            x: -20
        }
    }

    const items = ['Item 1', 'Item 2', 'Item 3', 'Item 4']
</script>

<div
    style={styleString(() => ({
        padding: '2rem',
        background: 'var(--color-background-secondary)',
        borderRadius: 8,
        margin: '2rem 0'
    }))}
>
    <button
        style={styleString(() => ({
            padding: '0.5rem 1rem',
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '1rem'
        }))}
        onclick={() => (isVisible = !isVisible)}
    >
        {isVisible ? 'Hide' : 'Show'} Items
    </button>

    <motion.ul
        style={styleString(() => ({
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
        }))}
        variants={containerVariants}
        initial="hidden"
        animate={isVisible ? 'visible' : 'hidden'}
    >
        {#each items as item, i (i)}
            <motion.li
                style={styleString(() => ({
                    padding: '1rem',
                    background: 'var(--color-background)',
                    borderRadius: 6,
                    border: '1px solid var(--color-border)'
                }))}
                variants={itemVariants}
                transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 24,
                    delay: i * 0.1
                }}
            >
                {item}
            </motion.li>
        {/each}
    </motion.ul>
</div>
