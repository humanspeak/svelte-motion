<script lang="ts">
    /**
     * Regression for the stale-velocity bug: when the user drags fast,
     * then HOLDS the pointer stationary for several hundred ms before
     * releasing, the release should produce ~0 velocity (and thus no
     * inertia fling). Previously the 5-sample velocity window had no
     * max-age filter, so the oldest sample was still the pre-pause
     * fast-motion sample even after a long stationary hold.
     */
    import { motion } from '$lib'
</script>

<div style="height: 320px; display: grid; place-items: center">
    <motion.div
        drag="x"
        data-testid="drag-card"
        style="width:100px;height:100px;background:#a78bfa;border-radius:8px;cursor:grab;user-select:none;"
    />
</div>
