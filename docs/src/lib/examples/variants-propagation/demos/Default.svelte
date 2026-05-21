<script lang="ts">
    import { motion, styleString, type Variants } from '@humanspeak/svelte-motion'

    // Parent's `animate` doesn't just animate the parent — it cascades to
    // every descendant `motion.*` element. Each descendant looks up the
    // same variant label in its own `variants` map. Per-element
    // `transition` keeps timing independent (here: stagger per `i`).
    let isVisible = $state(false)

    const containerVariants: Variants = {
        visible: { opacity: 1 },
        hidden: { opacity: 0 }
    }

    const itemVariants: Variants = {
        visible: { opacity: 1, x: 0 },
        hidden: { opacity: 0, x: -20 }
    }

    const items = ['Item 1', 'Item 2', 'Item 3', 'Item 4']
</script>

<!-- HUMANSPEAK: docs-kit positioning shell — stripped from the published code. -->
<div class="humanspeak-demo-shell">
    <div class="stage">
        <button class="toggle" type="button" onclick={() => (isVisible = !isVisible)}>
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
</div>

<style>
    .humanspeak-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 460px;
    }

    .stage {
        width: 320px;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .toggle {
        align-self: flex-start;
        padding: 0.5rem 1rem;
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
    }
</style>
