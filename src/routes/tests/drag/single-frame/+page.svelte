<script lang="ts">
    /**
     * Regression for single-frame-drag spurious velocity. A tap with one
     * tiny pointermove between down and up should produce ~0 release
     * velocity — there aren't enough samples to reliably infer motion.
     */
    import { motion } from '$lib'
</script>

<div style="height: 200px; display: grid; place-items: center">
    <motion.div
        drag
        data-testid="drag-card"
        style="width:100px;height:100px;background:#facc15;border-radius:8px;cursor:grab;user-select:none;"
    />
</div>
