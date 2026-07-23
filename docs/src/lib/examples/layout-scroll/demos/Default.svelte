<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'

    // Two side-by-side scroll containers. Identical FLIP animations
    // inside. Only the right one has `layoutScroll`. Click "expand",
    // then drag the scrollbar in either panel mid-animation:
    //   - Left:  the ink box drifts (FLIP measures viewport-relative
    //            rects, so the scroll offset leaks into the delta).
    //   - Right: the accent box stays anchored (layoutScroll re-bases
    //            measurements in the scroll container's coordinate
    //            space).

    let expanded = $state(false)
    const sizeRest = '120px'
    const sizeExpanded = '220px'

    // Slow tween so a viewer has time to grab the scrollbar mid-animation
    // and actually feel the difference between the two panels.
    const slowTransition = { duration: 1.8, ease: 'easeInOut' as const }

    const scrollContainerStyle = styleString(() => ({
        overflow: 'auto',
        height: '240px',
        border: '1px solid var(--brut-rule-2, #bbc4c0)',
        background: 'var(--brut-bg, #f8fcfb)'
    }))

    function toggle() {
        expanded = !expanded
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="panel">
        <div class="panel-head">
            <span class="micro">// layout scroll</span>
            <span class="micro readout">state: {expanded ? 'expanded' : 'rest'}</span>
        </div>

        <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.03 }}
            onclick={toggle}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={styleString(() => ({
                alignSelf: 'flex-start',
                fontFamily: 'var(--brut-mono, monospace)',
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                border: '1px solid var(--brut-accent, #247768)',
                background: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                color: 'var(--brut-accent, #247768)',
                padding: '0.5rem 0.875rem',
                cursor: 'pointer'
            }))}
        >
            {expanded ? 'shrink box' : 'expand box →'}
        </motion.button>

        <div class="grid">
            <article>
                <header>
                    <strong>without <code>layoutScroll</code></strong>
                    <span class="pill pill-drift">drifts on scroll</span>
                </header>
                <div style={scrollContainerStyle}>
                    <div class="spacer-top"></div>
                    <motion.div
                        layout
                        transition={slowTransition}
                        style={styleString(() => ({
                            width: expanded ? sizeExpanded : sizeRest,
                            height: expanded ? sizeExpanded : sizeRest,
                            border: '1px solid var(--brut-ink, #0a0a0a)',
                            background: 'var(--brut-ink, #0a0a0a)',
                            margin: '0 auto'
                        }))}
                    ></motion.div>
                    <div class="spacer-bottom"></div>
                </div>
            </article>

            <article>
                <header>
                    <strong>with <code>layoutScroll</code></strong>
                    <span class="pill pill-anchor">stays anchored</span>
                </header>
                <motion.div layoutScroll style={scrollContainerStyle}>
                    <div class="spacer-top"></div>
                    <motion.div
                        layout
                        transition={slowTransition}
                        style={styleString(() => ({
                            width: expanded ? sizeExpanded : sizeRest,
                            height: expanded ? sizeExpanded : sizeRest,
                            border: '1px solid var(--brut-accent, #247768)',
                            background: 'var(--brut-accent, #247768)',
                            margin: '0 auto'
                        }))}
                    ></motion.div>
                    <div class="spacer-bottom"></div>
                </motion.div>
            </article>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 460px;
    }

    .panel {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1.5rem;
        width: 100%;
        max-width: 720px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }

    .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
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
    }

    .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }

    strong {
        font-family: var(--brut-mono, monospace);
        font-size: 0.8125rem;
        font-weight: 700;
        color: var(--brut-ink, #0a0a0a);
    }

    code {
        font-family: var(--brut-mono, monospace);
    }

    .pill {
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 2px 6px;
        border: 1px solid;
    }

    .pill-drift {
        color: var(--brut-ink-2, #525252);
        border-color: var(--brut-ink-2, #525252);
    }

    .pill-anchor {
        color: var(--brut-accent, #247768);
        border-color: var(--brut-accent, #247768);
    }

    .spacer-top {
        height: 60px;
    }

    .spacer-bottom {
        height: 360px;
    }
</style>
