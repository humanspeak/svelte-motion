<script lang="ts">
    import { motion, MotionConfig } from '$lib'

    let { data }: { data: { slow: boolean } } = $props()

    const duration = $derived(data.slow ? 3.2 : 1.6)
    const transition = $derived({
        duration,
        scale: { type: 'spring', visualDuration: duration, bounce: 0.5 }
    })
</script>

<MotionConfig {transition}>
    <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        style="width: 100px; height: 100px; background-color: red; border-radius: 50%;"
        data-testid="motion-div"
    />
</MotionConfig>
