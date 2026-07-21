<script lang="ts">
    import { motion, styleString, useCycle } from '@humanspeak/svelte-motion'

    // `useCycle(...labels)` returns `{ current, cycle }`. `.cycle()` advances
    // through the labels in order, `.cycle(i)` jumps to a specific index, and
    // `.current` is the live value (reactive via Svelte 5 `$state`). Pair it
    // with a `variants` map keyed by the same labels and you have a tiny
    // state machine with declarative animation per state.
    const variants = {
        rest: { x: 0, rotate: 0, scale: 1, backgroundColor: '#667eea' },
        nudge: { x: 90, rotate: 8, scale: 1.05, backgroundColor: '#7c3aed' },
        flip: { x: 90, rotate: 188, scale: 1.1, backgroundColor: '#db2777' },
        spin: { x: 0, rotate: 540, scale: 1, backgroundColor: '#f59e0b' }
    } as const

    const labels = ['rest', 'nudge', 'flip', 'spin'] as const
    const variant = useCycle<keyof typeof variants>(...labels)

    const cardStyle = styleString(() => ({
        width: 96,
        height: 96,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--brut-mono, monospace)',
        fontWeight: 700,
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: '#f8fcfb',
        border: '1px solid var(--brut-ink, #0a0a0a)',
        boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)',
        willChange: 'transform'
    }))

    const advanceStyle = styleString(() => ({
        fontFamily: 'var(--brut-mono, monospace)',
        fontSize: '0.6875rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        border: '1px solid var(--brut-accent, #247768)',
        backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
        color: 'var(--brut-accent, #247768)',
        padding: '0.4rem 0.75rem',
        cursor: 'pointer'
    }))

    const jumpStyle = (active: boolean) =>
        styleString(() => ({
            fontFamily: 'var(--brut-mono, monospace)',
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            border: active
                ? '1px solid var(--brut-ink, #0a0a0a)'
                : '1px solid var(--brut-rule-2, #bbc4c0)',
            backgroundColor: active ? 'var(--brut-bg-2, #eef4f1)' : 'transparent',
            color: active ? 'var(--brut-ink, #0a0a0a)' : 'var(--brut-ink-2, #525252)',
            padding: '0.4rem 0.6rem',
            cursor: 'pointer'
        }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// use-cycle</span>
            <span class="micro readout">current: {variant.current}</span>
        </div>

        <div class="stage">
            <div class="track">
                <motion.div
                    style={cardStyle}
                    {variants}
                    animate={variant.current}
                    transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                >
                    {variant.current}
                </motion.div>
            </div>
        </div>

        <div class="controls">
            <div class="control-cell">
                <motion.button
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    style={advanceStyle}
                    onclick={() => variant.cycle()}
                >
                    cycle()
                </motion.button>
                <span class="control-caption">advance</span>
            </div>
            {#each labels as label, i (label)}
                <div class="control-cell">
                    <motion.button
                        type="button"
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                        style={jumpStyle(variant.current === label)}
                        onclick={() => variant.cycle(i)}
                    >
                        cycle({i})
                    </motion.button>
                    <span class="control-caption" class:active-caption={variant.current === label}>
                        {label}
                    </span>
                </div>
            {/each}
        </div>

        <div class="strip-foot">
            <span class="micro">variants keyed by cycle labels</span>
            <span class="micro">spring: 220 / 18</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 420px;
    }

    .strip {
        width: 100%;
        max-width: 420px;
        display: flex;
        flex-direction: column;
        gap: 1rem;
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
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        border: 1px solid var(--brut-rule, #d6dedb);
        background: var(--brut-bg-2, #eef4f1);
    }

    .track {
        width: 240px;
        display: flex;
        align-items: center;
        justify-content: flex-start;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: center;
        gap: 12px 10px;
    }

    .control-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
    }

    .control-caption {
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .control-caption.active-caption {
        color: var(--brut-accent, #247768);
    }
</style>
