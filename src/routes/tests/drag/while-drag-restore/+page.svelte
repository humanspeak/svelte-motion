<script lang="ts">
    /**
     * Regression for `whileDrag` baseline restore lands on the wrong
     * value when the user re-grabs mid-restore. The card has a
     * `whileDrag={{ scale: 1.05 }}` modifier; on each release the
     * restore animation pulls the scale back to 1.0. Re-grabbing during
     * that restore should still leave the card at scale=1.0 after the
     * second release, not at some intermediate captured-baseline value.
     */
    import { motion } from '$lib'
</script>

<div style="height: 240px; display: grid; place-items: center">
    <motion.div
        drag
        whileDrag={{ scale: 1.05 }}
        transition={{ duration: 0.4 }}
        data-testid="drag-card"
        style="width:100px;height:100px;background:#f472b6;border-radius:8px;cursor:grab;user-select:none;"
    />
</div>
