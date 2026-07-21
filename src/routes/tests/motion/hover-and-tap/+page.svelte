<script lang="ts">
    import { MotionConfig, motion } from '$lib'
</script>

<!-- Mirrors the docs examples shell, which wraps every demo in
     MotionConfig transition={{ duration: 0.6 }} — keeping this page at the
     same speed lets gesture behavior be compared 1:1 against
     /examples/hover-and-tap. -->
<MotionConfig transition={{ duration: 0.6 }}>
    <motion.div
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.8 }}
        style="width: 100px; height: 100px; background-color: #9911ff; border-radius: 5px;"
        data-testid="motion-hover-and-tap"
    />
</MotionConfig>
