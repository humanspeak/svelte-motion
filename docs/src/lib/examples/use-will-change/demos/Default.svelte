<script lang="ts">
    import { Sparkles } from '@lucide/svelte'
    import { motion, styleString, useWillChange } from '@humanspeak/svelte-motion'

    // Two independent will-change values: one attached to a transform animation,
    // one to a paint-only animation. The badge on each box shows its live value.
    const moveWillChange = useWillChange()
    const paintWillChange = useWillChange()

    let started = $state(false)
    let moved = $state(false)
    let recolored = $state(false)

    // Travel is measured from the lane so the box lands inside the far
    // padding instead of clipping against the lane's right edge.
    const BOX_WIDTH = 116
    const LANE_PADDING = 16
    let laneWidth = $state(0)
    const travel = $derived(Math.max(laneWidth - LANE_PADDING * 2 - BOX_WIDTH, 0))

    // No transform key until the first click, so will-change starts at "auto".
    const moveTarget = $derived(started ? { x: moved ? travel : 0 } : {})

    const toggleMove = () => {
        started = true
        moved = !moved
    }

    // Library-driven button chrome: base style is inline, the hover paint swap
    // is a `whileHover` motion prop (no CSS :hover doing motion work).
    const buttonStyle = styleString(() => ({
        justifySelf: 'start',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontFamily: 'var(--brut-mono, monospace)',
        fontSize: '0.6875rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        border: '1px solid var(--brut-accent, #247768)',
        backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
        color: 'var(--brut-accent, #247768)',
        padding: '0.5rem 0.875rem',
        cursor: 'pointer'
    }))
    const buttonHover = {
        scale: 1.04,
        backgroundColor: 'var(--brut-accent, #247768)',
        color: 'var(--brut-accent-ink, #f8fcfb)'
    }
    const buttonTap = { scale: 0.96 }
    const buttonTransition = { type: 'spring', stiffness: 500, damping: 30 } as const
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// usewillchange</span>
            <span class="micro readout">
                will-change: {moveWillChange.current} · {paintWillChange.current}
            </span>
        </div>

        <div class="row">
            <section class="cell">
                <header>
                    <span class="tag promote">promotes</span>
                    <span class="label">Animating <code>x</code> (transform)</span>
                </header>
                <div class="lane" bind:clientWidth={laneWidth}>
                    <motion.div
                        class="box move"
                        style={{ willChange: moveWillChange }}
                        initial={false}
                        animate={moveTarget}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <small>will-change</small>
                        <span class="val" class:on={moveWillChange.current === 'transform'}>
                            {moveWillChange.current}
                        </span>
                    </motion.div>
                </div>
                <motion.button
                    type="button"
                    onclick={toggleMove}
                    whileHover={buttonHover}
                    whileTap={buttonTap}
                    transition={buttonTransition}
                    style={buttonStyle}
                >
                    <Sparkles size={14} />
                    {moved ? 'Return' : 'Animate x'}
                </motion.button>
            </section>

            <section class="cell">
                <header>
                    <span class="tag stay">stays auto</span>
                    <span class="label">Animating <code>backgroundColor</code> (paint)</span>
                </header>
                <div class="lane">
                    <motion.div
                        class="box paint"
                        style={{ willChange: paintWillChange }}
                        initial={false}
                        animate={{ backgroundColor: recolored ? '#ec4899' : '#247768' }}
                        transition={{ duration: 0.6 }}
                    >
                        <small>will-change</small>
                        <span class="val" class:on={paintWillChange.current === 'transform'}>
                            {paintWillChange.current}
                        </span>
                    </motion.div>
                </div>
                <motion.button
                    type="button"
                    onclick={() => (recolored = !recolored)}
                    whileHover={buttonHover}
                    whileTap={buttonTap}
                    transition={buttonTransition}
                    style={buttonStyle}
                >
                    <Sparkles size={14} />
                    {recolored ? 'Reset' : 'Animate color'}
                </motion.button>
            </section>
        </div>

        <div class="strip-foot">
            <span class="micro">transform promotes · paint stays auto</span>
            <span class="micro">hook: usewillchange</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 360px;
    }

    .strip {
        width: 100%;
        max-width: 640px;
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

    .row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
    }

    /* Each cell spans the shared header/lane/button rows via subgrid, so the
       stages and buttons stay aligned even when one header label runs longer. */
    .cell {
        grid-row: span 3;
        display: grid;
        grid-template-rows: subgrid;
        gap: 0.75rem;
        padding: 0.875rem;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
    }

    header {
        display: grid;
        justify-items: start;
        align-content: start;
        gap: 0.375rem;
        font-size: 13px;
        color: var(--brut-ink-2, #525252);
    }

    header code {
        color: var(--brut-accent, #247768);
        font-family: var(--brut-mono, monospace);
    }

    .tag {
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 2px 7px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
    }

    .tag.promote {
        color: var(--brut-accent, #247768);
        border-color: var(--brut-accent, #247768);
    }

    .tag.stay {
        color: var(--brut-ink-3, #9a9a9a);
    }

    /* Fixed-height lane in normal flow — can't collapse, and overflow clips the
       box as it slides so the translate stays self-contained. */
    .lane {
        position: relative;
        height: 124px;
        display: flex;
        align-items: center;
        padding: 0 16px;
        overflow: hidden;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #f8fcfb);
    }

    /* Both boxes share one constant teal fill so they read as siblings. The
       paint box animates backgroundColor between fixed hexes, so its fill
       can't be a theme var — the move box uses the same fixed teal to match.
       motion.* render their own elements, so Svelte's scoping never reaches
       them — hence :global. */
    :global(.dk-demo-shell .box) {
        flex: none;
        width: 116px;
        height: 92px;
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 4px;
        background: #247768;
        color: #f8fcfb;
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }

    :global(.dk-demo-shell .box small) {
        font-size: 9px;
        font-weight: 850;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        opacity: 0.72;
    }

    /* Live will-change readout chip. The boxes are constant fills in both
       themes, so a fixed dark/light ink pair keeps contrast regardless of theme
       — and a <span> avoids docs-kit's global <strong> color rule. The chip
       inverts to a light fill while will-change is promoted. */
    :global(.dk-demo-shell .box .val) {
        padding: 2px 9px;
        background: rgba(9, 26, 23, 0.85);
        color: #f8fcfb;
        font-size: 15px;
        font-weight: 700;
        font-family: var(--brut-mono, monospace);
    }

    :global(.dk-demo-shell .box .val.on) {
        background: #f8fcfb;
        color: #247768;
    }

    @media (max-width: 720px) {
        .row {
            grid-template-columns: 1fr;
        }
    }
</style>
