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
        fanned: 'explode →',
        exploded: 'stack →',
        stacked: 'fan out →'
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

    function cycle() {
        state = STATES[(STATES.indexOf(state) + 1) % STATES.length]
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// variants-dynamic</span>
            <span class="micro readout">state: {state}</span>
        </div>

        <div class="stage">
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
                        background: 'var(--brut-bg-2, #eef4f1)',
                        border: '1px solid var(--brut-rule-2, #bbc4c0)',
                        boxShadow: '5px 5px 0 var(--brut-rule, #d6dedb)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'flex-start',
                        padding: '0.75rem',
                        color: 'var(--brut-ink, #0a0a0a)',
                        fontFamily: 'var(--brut-mono, monospace)',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        letterSpacing: '0.04em',
                        cursor: 'pointer',
                        zIndex: i + 1
                    }))}
                >
                    №{i + 1}
                </motion.div>
            {/each}
        </div>

        <div class="strip-foot">
            <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                onclick={cycle}
                style={styleString(() => ({
                    fontFamily: 'var(--brut-mono, monospace)',
                    fontSize: '0.6875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    border: '1px solid var(--brut-accent, #247768)',
                    backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                    color: 'var(--brut-accent, #247768)',
                    padding: '0.5rem 0.875rem',
                    cursor: 'pointer'
                }))}
            >
                {NEXT_LABEL[state]}
            </motion.button>
            <span class="micro">every card resolves variants[{state}](i)</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 480px;
    }

    .strip {
        width: 100%;
        max-width: 560px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .readout {
        color: var(--brut-accent, #247768);
        text-transform: none;
    }

    .strip-head,
    .strip-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .strip-foot {
        border-bottom: none;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
        padding-bottom: 0;
    }

    .stage {
        position: relative;
        height: 280px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
