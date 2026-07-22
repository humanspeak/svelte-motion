<script lang="ts">
    import { MotionConfig, motion } from '$lib'
</script>

<!-- Regression page for the hover→tap multichannel handoff. An interrupted
     whileHover carrying BOTH scale and y must hand off to whileTap with NO
     first-frame jump on ANY channel: the composed writer writes every owned
     transform channel externally (bypassing motion's internal motion values),
     so tap must seed each channel from its VISUAL value instead of snapping to
     motion's stale internal value on frame one. See plan 002. -->
<MotionConfig transition={{ duration: 0.6 }}>
    <motion.div
        whileHover={{ scale: 1.2, y: -20 }}
        whileTap={{ scale: 0.9, y: 0 }}
        style="width: 100px; height: 100px; background-color: #247768;"
        data-testid="motion-multichannel-handoff"
    />
</MotionConfig>
