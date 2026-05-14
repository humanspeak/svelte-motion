<script lang="ts">
    /**
     * Regression for pointercancel triggering momentum/fling.
     *
     * Real `pointercancel` events fire when the OS preempts a drag (touch
     * interrupted by gesture-nav, palm rejection, scroll/zoom takes
     * over). The user did not intend to release — the gesture was
     * cancelled out from under them. Running momentum in this case
     * flings the card unexpectedly.
     */
    import { motion } from '$lib'
</script>

<div style="height: 240px; display: grid; place-items: center">
    <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.18}
        data-testid="drag-card"
        style="width:100px;height:100px;background:#a3e635;border-radius:8px;cursor:grab;user-select:none;"
    />
</div>
