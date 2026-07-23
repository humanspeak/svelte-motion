<script lang="ts">
    import {
        animate,
        createDragControls,
        motion,
        styleString,
        useAnimate,
        useMotionValue
    } from '@humanspeak/svelte-motion'

    let open = $state(false)

    // `useAnimate` scopes imperative animations to the overlay it attaches to,
    // so the backdrop can fade on close.
    const [scope, scopedAnimate] = useAnimate()

    // The sheet element, measured at close time so it slides fully off-screen.
    let sheetRef = $state<HTMLElement | null>(null)

    // The bound drag offset. `drag` writes this MotionValue (so `y.get()` reads
    // the live position) and the close animation drives it back — animating the
    // same value the gesture left off (#421).
    const y = useMotionValue(0)
    const controls = createDragControls()

    const handleClose = async () => {
        // Fade the backdrop out…
        if (scope.current) scopedAnimate(scope.current, { opacity: [1, 0] })

        // …and slide the sheet down by its own height, continuing from wherever
        // the drag left it.
        const height = sheetRef?.offsetHeight ?? 0
        await animate(y, height, {
            duration: 0.3,
            ease: 'easeInOut'
        })

        open = false
        // Reset for the next open (the MotionValue outlives the {#if} block).
        y.set(0)
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// mobile drawer</span>
            <span class="micro status">state: {open ? 'open' : 'closed'}</span>
        </div>

        <section class="phone-wrap" aria-label="Drag to close drawer example">
            <div class="phone">
                <div class="screen">
                    <p class="screen-hint">Tap to open the bottom sheet</p>
                    <motion.button
                        onclick={() => (open = true)}
                        whileHover={{ y: -2, scale: 1.04 }}
                        whileTap={{ y: 0, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={styleString(() => ({
                            fontFamily: 'var(--brut-mono, monospace)',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            border: '1px solid var(--brut-accent, #247768)',
                            backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                            color: 'var(--brut-accent, #247768)',
                            padding: '0.6rem 1rem',
                            cursor: 'pointer'
                        }))}
                    >
                        Open drawer
                    </motion.button>
                </div>

                {#if open}
                    <motion.div
                        {@attach scope}
                        scoped:class="overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onclick={handleClose}
                    >
                        <motion.div
                            bind:ref={sheetRef}
                            scoped:class="sheet"
                            style={{ y }}
                            initial={{ y: '100%' }}
                            animate={{ y: '0%' }}
                            transition={{ ease: 'easeInOut' }}
                            drag="y"
                            dragControls={controls}
                            dragListener={false}
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={{ top: 0, bottom: 0.5 }}
                            onclick={(e: MouseEvent) => e.stopPropagation()}
                            onDragEnd={() => {
                                if (y.get() >= 100) handleClose()
                            }}
                        >
                            <div class="handle-row">
                                <button
                                    class="handle"
                                    aria-label="Drag to close"
                                    onpointerdown={(e: PointerEvent) => controls.start(e)}
                                ></button>
                            </div>
                            <div class="sheet-body">
                                <h3>Drag me down to close</h3>
                                <p>
                                    Grab the handle and pull this sheet down past the threshold to
                                    dismiss it, or tap the backdrop. The drag writes the bound
                                    <code>y</code> MotionValue, and the close animation continues from
                                    wherever you let go.
                                </p>
                                <p>
                                    Release before the threshold and it springs back into place with
                                    a little elastic give.
                                </p>
                                <div class="rows">
                                    <span></span><span></span><span></span><span></span>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                {/if}
            </div>
        </section>

        <div class="strip-foot">
            <span class="micro">drag y · threshold 100px</span>
            <span class="micro">elastic 0.5 · ease in-out</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        min-height: 560px;
        display: grid;
        place-items: center;
        padding: clamp(1rem, 4vw, 2.5rem);
    }

    .strip {
        width: 100%;
        max-width: min(360px, 92vw);
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

    .status {
        color: var(--brut-accent, #247768);
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

    .phone-wrap {
        display: grid;
        place-items: center;
        width: 100%;
    }

    /* The phone is a hard brutalist device frame — square corners read as a
       screen mockup once wrapped in the strip chrome; both themes are driven by
       --brut-* vars so the frame never hardcodes a dark/light background. */
    .phone {
        position: relative;
        width: 100%;
        height: 600px;
        max-height: 70vh;
        overflow: hidden;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }

    .screen {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        justify-items: center;
        gap: 1rem;
        text-align: center;
        padding: 1.5rem;
    }

    .screen-hint {
        margin: 0;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-2, #525252);
    }

    /* The overlay + sheet are `motion` components. `scoped:class` (a Svelte
       Motion feature) keeps this component's scope on their rendered elements,
       so these plain scoped selectors apply without needing `:global()`. */
    .overlay {
        position: absolute;
        inset: 0;
        z-index: 10;
        background: color-mix(in oklab, var(--brut-ink, #0a0a0a) 45%, transparent);
        backdrop-filter: blur(2px);
    }

    .sheet {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 78%;
        overflow: hidden;
        border: 1px solid var(--brut-ink, #0a0a0a);
        border-bottom: none;
        background: var(--brut-bg, #f8fcfb);
        box-shadow: 0 -6px 0 var(--brut-rule, #d6dedb);
    }

    .handle-row {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1;
        display: flex;
        justify-content: center;
        padding: 0.85rem;
        border-bottom: 1px dashed var(--brut-rule, #d6dedb);
        background: var(--brut-bg, #f8fcfb);
    }

    .handle {
        appearance: none;
        height: 6px;
        width: 56px;
        padding: 0;
        border: none;
        background: var(--brut-rule-2, #bbc4c0);
        cursor: grab;
        touch-action: none;
    }

    .handle:active {
        cursor: grabbing;
    }

    .sheet-body {
        height: 100%;
        overflow-y: auto;
        padding: 3.25rem 1.4rem 1.4rem;
        color: var(--brut-ink-2, #525252);
    }

    .sheet-body h3 {
        margin: 0 0 0.6rem;
        font-size: 1.25rem;
        font-weight: 800;
        color: var(--brut-ink, #0a0a0a);
    }

    .sheet-body p {
        margin: 0 0 0.85rem;
        font-size: 0.92rem;
        line-height: 1.5;
    }

    .sheet-body code {
        font-family: var(--brut-mono, monospace);
        font-size: 0.85em;
        padding: 0.08em 0.34em;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        color: var(--brut-accent, #247768);
    }

    .rows {
        display: grid;
        gap: 0.75rem;
        margin-top: 1.25rem;
    }

    .rows span {
        height: 2.5rem;
        border: 1px solid var(--brut-rule, #d6dedb);
        background: var(--brut-bg-2, #eef4f1);
    }
</style>
