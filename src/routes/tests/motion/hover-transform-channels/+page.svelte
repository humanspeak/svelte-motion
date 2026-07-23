<script lang="ts">
    import { MotionConfig, motion } from '$lib'
</script>

<!-- Mirrors the docs examples shell speed (MotionConfig duration 0.6) so
     gesture behavior compares 1:1 against /examples/variants-while-hover.
     Regression page: whileHover carrying BOTH scale and another transform
     channel must render both — the composed scale writer and the native
     writer may never fight over el.style.transform. -->
<MotionConfig transition={{ duration: 0.6 }}>
    <motion.div
        whileHover={{ scale: 1.2, y: -8 }}
        whileTap={{ scale: 0.9 }}
        style="width: 100px; height: 100px; background-color: #247768; border-radius: 5px;"
        data-testid="motion-hover-transform-channels"
    />
</MotionConfig>
