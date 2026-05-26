<script lang="ts">
    import { animate, motion, useMotionValue, useTransform } from '@humanspeak/svelte-motion'

    // Dismiss thresholds — either condition fires close.
    const DISMISS_OFFSET_PX = 120
    const DISMISS_VELOCITY_PX_S = 700

    let open = $state(true)
    const y = useMotionValue(0)
    const overlayOpacity = useTransform(y, [0, 300], [1, 0])

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
    <div class="stage">
        {#if open}
            <!-- Backdrop fades as the sheet pulls away. -->
            <div class="overlay" style="opacity: {overlayOpacity.current}" aria-hidden="true"></div>

            <motion.div
                class="sheet"
                style="transform: translateY({y.current}px)"
                onPan={handlePan}
                onPanEnd={handlePanEnd}
                whilePan={{ cursor: 'grabbing' }}
                role="dialog"
                aria-label="Demo sheet — pull down or flick to dismiss"
            >
                <div class="grabber" aria-hidden="true"></div>
                <h3>flick to dismiss</h3>
                <p>
                    Pull down past 120px, <em>or</em> flick downward at > 700 px/s. The release decision
                    combines both — fast flicks commit even when distance is short.
                </p>
                <ul>
                    <li>follows your finger 1:1 while you drag</li>
                    <li>springs home if you don't pass the threshold</li>
                    <li>animates off-screen if you do</li>
                </ul>
            </motion.div>
        {:else}
            <button class="reopen" type="button" onclick={reopen}>↑ reopen the sheet</button>
        {/if}
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

    .stage {
        position: relative;
        width: 100%;
        max-width: 360px;
        height: 460px;
        border-radius: 18px;
        background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
        border: 1px solid #cbd5e1;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6);
        overflow: hidden;
        font-family:
            ui-sans-serif,
            system-ui,
            -apple-system,
            sans-serif;
    }

    .overlay {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.42);
        pointer-events: none;
    }

    /* `motion.div` renders the element from a child component, so anything
       targeting its class must escape Svelte's component-scoped CSS via
       :global(). */
    :global(.sheet) {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 12px 22px 28px;
        background: #ffffff;
        border-radius: 18px 18px 0 0;
        box-shadow: 0 -12px 32px -8px rgba(15, 23, 42, 0.25);
        cursor: grab;
        touch-action: none;
        user-select: none;
        will-change: transform;
    }

    :global(.sheet h3) {
        margin: 8px 0 6px;
        font-size: 16px;
        font-weight: 600;
        color: #0f172a;
    }

    :global(.sheet p) {
        margin: 0 0 12px;
        font-size: 13px;
        line-height: 1.5;
        color: #475569;
    }

    :global(.sheet ul) {
        margin: 0;
        padding-left: 18px;
        font-size: 12.5px;
        line-height: 1.6;
        color: #64748b;
    }

    .grabber {
        margin: 0 auto 16px;
        width: 36px;
        height: 4px;
        border-radius: 999px;
        background: #cbd5e1;
    }

    .reopen {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 10px 18px;
        border-radius: 10px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #0f172a;
        font-family: inherit;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }

    .reopen:hover {
        border-color: #94a3b8;
    }
</style>
