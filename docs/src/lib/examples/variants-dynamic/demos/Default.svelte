<script lang="ts">
    import { motion, styleString, type Variants } from '@humanspeak/svelte-motion'

    // Seven cards cycle through three named states (`fanned`,
    // `exploded`, `stacked`). Each state is a *function* variant —
    // `(i) => keyframes` — and the `custom={i}` prop forwards each
    // card's index into the function. That's the dynamic-variant
    // shape: one variants map, per-instance values without
    // duplicating keyframes.

    const STATES = ['fanned', 'exploded', 'stacked'] as const
    type State = (typeof STATES)[number]

    const NEXT_LABEL: Record<State, string> = {
        fanned: 'Explode →',
        exploded: 'Stack →',
        stacked: 'Fan out →'
    }

    let state = $state<State>('fanned')

    const CARDS = 7
    const cards = Array.from({ length: CARDS }, (_, i) => i)
    const center = (CARDS - 1) / 2

    const cardVariants: Variants = {
        fanned: (i) => {
            const offset = (i as number) - center
            return {
                x: offset * 22,
                y: Math.abs(offset) * 12,
                rotate: offset * 9,
                scale: 1,
                opacity: 1,
                transition: { type: 'spring', stiffness: 220, damping: 22 }
            }
        },
        exploded: (i) => {
            const offset = (i as number) - center
            return {
                x: offset * 95,
                y: -Math.abs(offset) * 8 - 20,
                rotate: offset * 14,
                scale: 1.05,
                opacity: 1,
                transition: { type: 'spring', stiffness: 200, damping: 18 }
            }
        },
        stacked: (i) => ({
            x: (i as number) * 1,
            y: -(i as number) * 1,
            rotate: 0,
            scale: 1,
            opacity: 1,
            transition: {
                type: 'spring',
                stiffness: 320,
                damping: 30,
                delay: (i as number) * 0.03
            }
        })
    }

    const hues = ['#f97316', '#ec4899', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308', '#ef4444']

    function cycle() {
        state = STATES[(STATES.indexOf(state) + 1) % STATES.length]
    }
</script>

<!-- HUMANSPEAK: docs-kit positioning shell — stripped from the published code. -->
<div class="humanspeak-demo-shell">
    <div
        style={styleString(() => ({
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '440px',
            padding: '2rem'
        }))}
    >
        <div
            style={styleString(() => ({
                position: 'relative',
                width: '100%',
                height: '280px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }))}
        >
            {#each cards as i (i)}
                <motion.div
                    custom={i}
                    variants={cardVariants}
                    initial="stacked"
                    animate={state}
                    whileHover={{
                        scale: 1.15,
                        zIndex: 10,
                        transition: { type: 'spring', stiffness: 320, damping: 20 }
                    }}
                    style={styleString(() => ({
                        position: 'absolute',
                        width: '110px',
                        height: '160px',
                        borderRadius: 12,
                        background: `linear-gradient(155deg, ${hues[i]} 0%, ${hues[(i + 3) % hues.length]} 100%)`,
                        boxShadow:
                            '0 14px 38px -12px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.12) inset, 0 1px 0 rgba(255,255,255,0.25) inset',
                        border: '2px solid rgba(255,255,255,0.6)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        padding: '0.75rem',
                        color: 'white',
                        fontFamily: 'JetBrains Mono Variable, ui-monospace, monospace',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                        cursor: 'pointer',
                        zIndex: i + 1
                    }))}
                >
                    №{i + 1}
                </motion.div>
            {/each}
        </div>

        <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.04, backgroundColor: 'var(--color-brand-600)' }}
            onclick={cycle}
            style={styleString(() => ({
                marginTop: '1.5rem',
                padding: '0.65rem 1.5rem',
                background: 'var(--color-brand-500)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.02em',
                boxShadow:
                    '0 4px 14px -4px color-mix(in oklab, var(--color-brand-500) 70%, transparent)'
            }))}
        >
            {NEXT_LABEL[state]}
        </motion.button>

        <p
            style={styleString(() => ({
                marginTop: '0.85rem',
                fontSize: '0.78rem',
                color: 'var(--color-text-muted)',
                fontFamily: 'JetBrains Mono Variable, ui-monospace, monospace',
                letterSpacing: '0.02em'
            }))}
        >
            // state: <b style="color: var(--color-brand-500)">{state}</b> — every card resolves
            <code style="color: var(--color-text-primary)">variants[{state}](i)</code>
        </p>
    </div>
</div>

<style>
    .humanspeak-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 540px;
    }
</style>
