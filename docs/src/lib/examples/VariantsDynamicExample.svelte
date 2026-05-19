<script lang="ts">
    import { motion, styleString, type Variants } from '@humanspeak/svelte-motion'

    let cycle = $state(0)

    // Dynamic variant: each child receives its index as `custom` and the
    // factory derives a per-child delay + x offset from it.
    const item: Variants = {
        hidden: (i) => ({
            opacity: 0,
            x: -60 - (i as number) * 10,
            transition: { duration: 0.3 }
        }),
        visible: (i) => ({
            opacity: 1,
            x: 0,
            transition: {
                delay: (i as number) * 0.08,
                duration: 0.45
            }
        })
    }

    const items = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']
</script>

<div
    style={styleString(() => ({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '2rem',
        background: 'var(--color-background-secondary)',
        borderRadius: 8,
        margin: '2rem 0'
    }))}
>
    <motion.button
        style={styleString(() => ({
            alignSelf: 'flex-start',
            padding: '0.5rem 1rem',
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '0.5rem'
        }))}
        whileTap={{ scale: 0.96 }}
        onclick={() => (cycle += 1)}
    >
        Replay
    </motion.button>

    {#each items as item_label, i (cycle + '-' + i)}
        <motion.div
            custom={i}
            variants={item}
            initial="hidden"
            animate="visible"
            style={styleString(() => ({
                padding: '0.65rem 1rem',
                background: 'var(--color-background-tertiary, #ffffff10)',
                borderRadius: 6,
                color: 'var(--color-text-primary)',
                fontFamily: 'JetBrains Mono Variable, ui-monospace, monospace',
                fontSize: '0.95rem'
            }))}
        >
            №{i + 1} · {item_label} — custom={i}, delay={i * 0.08}s
        </motion.div>
    {/each}
</div>
