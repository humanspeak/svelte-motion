<script lang="ts">
    import {
        animate,
        motion,
        styleString,
        useMotionValue,
        useTransform
    } from '@humanspeak/svelte-motion'

    // Dismiss thresholds — either condition fires close.
    const DISMISS_OFFSET_PX = 120
    const DISMISS_VELOCITY_PX_S = 700

    let open = $state(true)
    const y = useMotionValue(0)
    const overlayOpacity = useTransform(y, [0, 300], [1, 0])

    // Live readouts for the strip chrome — reactive off the same MotionValue.
    const offsetY = $derived(Math.max(0, Math.round(y.current)))
    const armed = $derived(open && offsetY > DISMISS_OFFSET_PX)

    const reopen = () => {
        open = true
        y.jump(0)
    }

    const handlePan = (_event: PointerEvent, info: { offset: { y: number } }) => {
        // Clamp at 0 — only follow downward drags. Pulling up shouldn't
        // detach the sheet from its anchor.
        y.set(Math.max(0, info.offset.y))
    }

    const handlePanEnd = (
        _event: PointerEvent,
        info: { offset: { y: number }; velocity: { y: number } }
    ) => {
        const shouldDismiss =
            info.offset.y > DISMISS_OFFSET_PX || info.velocity.y > DISMISS_VELOCITY_PX_S
        if (shouldDismiss) {
            // Animate the sheet off-screen, then mark closed so the overlay
            // unmounts in the same frame the position lands.
            animate(y, 400, { type: 'spring', stiffness: 300, damping: 30 }).then(() => {
                open = false
            })
            return
        }
        // Snap back home with a snappy spring.
        animate(y, 0, { type: 'spring', stiffness: 400, damping: 32 })
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// pan-sheet</span>
            <span class="micro status">
                {open ? (armed ? 'armed → dismiss' : `y ${offsetY}px`) : 'dismissed'}
            </span>
        </div>

        <div class="stage">
            {#if open}
                <!-- Backdrop fades as the sheet pulls away. -->
                <div
                    class="overlay"
                    style="opacity: {overlayOpacity.current}"
                    aria-hidden="true"
                ></div>

                <motion.div
                    style={styleString(() => ({
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        transform: `translateY(${y.current}px)`,
                        padding: '0.875rem 1.25rem 1.5rem',
                        background: 'var(--brut-bg, #f8fcfb)',
                        border: '1px solid var(--brut-ink, #0a0a0a)',
                        borderBottom: 'none',
                        boxShadow: '-6px -6px 0 var(--brut-rule, #d6dedb)',
                        cursor: 'grab',
                        touchAction: 'none',
                        userSelect: 'none',
                        willChange: 'transform'
                    }))}
                    onPan={handlePan}
                    onPanEnd={handlePanEnd}
                    whilePan={{ cursor: 'grabbing' }}
                    role="dialog"
                    aria-label="Demo sheet — pull down or flick to dismiss"
                >
                    <div class="grabber" aria-hidden="true"></div>
                    <span class="sheet-tag">// sheet.01</span>
                    <h3 class="sheet-title">flick to dismiss</h3>
                    <p class="sheet-copy">
                        Pull down past 120px, <em>or</em> flick downward at > 700 px/s. The release decision
                        combines both — fast flicks commit even when distance is short.
                    </p>
                    <ul class="sheet-list">
                        <li>follows your finger 1:1 while you drag</li>
                        <li>springs home if you don't pass the threshold</li>
                        <li>animates off-screen if you do</li>
                    </ul>
                </motion.div>
            {:else}
                <motion.button
                    type="button"
                    onclick={reopen}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={styleString(() => ({
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
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
                    ↑ reopen the sheet
                </motion.button>
            {/if}
        </div>

        <div class="strip-foot">
            <span class="micro">offset ≥ 120px</span>
            <span class="micro">velocity ≥ 700px/s</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        width: 100%;
    }

    .strip {
        width: 100%;
        max-width: 360px;
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
        font-variant-numeric: tabular-nums;
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
        width: 100%;
        height: 420px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background:
            linear-gradient(90deg, var(--brut-rule, #d6dedb) 1px, transparent 1px),
            linear-gradient(0deg, var(--brut-rule, #d6dedb) 1px, transparent 1px),
            var(--brut-bg-2, #eef4f1);
        background-size:
            36px 36px,
            36px 36px,
            auto;
        overflow: hidden;
    }

    .overlay {
        position: absolute;
        inset: 0;
        background: var(--brut-ink, #0a0a0a);
        opacity: 0.42;
        pointer-events: none;
    }

    /* Plain children of the motion `.sheet` element DO receive scoped styles. */
    .grabber {
        margin: 0 auto 0.75rem;
        width: 40px;
        height: 4px;
        background: var(--brut-ink, #0a0a0a);
    }

    .sheet-tag {
        display: block;
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .sheet-title {
        margin: 0.375rem 0 0.5rem;
        font-family: var(--brut-mono, monospace);
        font-size: 0.9375rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        color: var(--brut-ink, #0a0a0a);
    }

    .sheet-copy {
        margin: 0 0 0.75rem;
        font-size: 0.8125rem;
        line-height: 1.5;
        color: var(--brut-ink-2, #525252);
    }

    .sheet-copy em {
        font-style: normal;
        font-weight: 700;
        color: var(--brut-accent, #247768);
    }

    .sheet-list {
        margin: 0;
        padding-left: 1.125rem;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        line-height: 1.7;
        color: var(--brut-ink-3, #9a9a9a);
    }
</style>
