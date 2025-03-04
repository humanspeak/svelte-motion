<script lang="ts">
    import { motion, MotionConfig } from '$lib/index.js'
</script>

<MotionConfig
    transition={{ duration: 0.4, scale: { type: 'spring', visualDuration: 0.4, bounce: 0.5 } }}
>
    <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        style="width: 100px; height: 100px; background-color: red; border-radius: 50%;"
        data-testid="motion-div"
    />
</MotionConfig>
