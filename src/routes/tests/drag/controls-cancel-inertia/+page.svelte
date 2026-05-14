<script lang="ts">
    /**
     * Regression for `controls.stop()` / `controls.cancel()` not actually
     * stopping the in-flight inertia animation after a release.
     *
     * Setup: a small draggable card with constraints. Drag past the
     * boundary so elastic engages, release with momentum, then click the
     * Stop button mid-spring. The card should freeze at whatever position
     * it had when stop() was called — not finish its snap-back to the
     * constraint edge.
     */
    import { motion, createDragControls } from '$lib'

    const controls = createDragControls()
    const stop = () => controls.stop()
</script>

<div style="height: 320px; display: grid; place-items: center; gap: 16px">
    <button type="button" data-testid="stop-btn" onclick={stop}>Stop</button>
    <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.18}
        dragTransition={{ bounceStiffness: 360, bounceDamping: 24 }}
        dragControls={controls}
        data-testid="drag-card"
        style="width:100px;height:100px;background:#10b981;border-radius:8px;cursor:grab;"
    />
</div>
