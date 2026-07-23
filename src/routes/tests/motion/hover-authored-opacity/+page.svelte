<script lang="ts">
    import { MotionConfig, motion } from '$lib'
</script>

<!-- Regression page for plan 003: opacity authored only via the style prop
     (0.8) must be restored on hover-end, not the neutral default of 1.
     whileHover animates opacity to 1; leaving must settle back to 0.8. -->
<MotionConfig transition={{ duration: 0.6 }}>
    <motion.div
        whileHover={{ opacity: 1 }}
        style="width: 100px; height: 100px; background: #247768; border-radius: 5px; opacity: 0.8;"
        data-testid="motion-hover-authored-opacity"
    />
</MotionConfig>
