<script lang="ts">
    /**
     * `pointercancel` mid-drag, matching Motion.
     *
     * Real `pointercancel` events fire when the OS preempts a drag (touch
     * interrupted by gesture-nav, palm rejection, scroll/zoom takes over).
     * Motion's `PanSession` handles `pointercancel` exactly like `pointerup`:
     * `onDragEnd` fires with the release velocity and momentum runs, so the
     * card keeps gliding before the constraint spring brings it back.
     */
    import { motion } from '$lib'

    // onDragEnd's velocity, for the e2e momentum check.
    let endVelocityX = $state<number | null>(null)
</script>

<div style="height: 240px; display: grid; place-items: center">
    <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.18}
        onDragEnd={(_event, info) => (endVelocityX = info.velocity.x)}
        data-end-velocity-x={endVelocityX}
        data-testid="drag-card"
        style="width:100px;height:100px;background:#a3e635;border-radius:8px;cursor:grab;user-select:none;"
    />
</div>
