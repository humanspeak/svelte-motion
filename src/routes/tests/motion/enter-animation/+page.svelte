<script lang="ts">
    import { motion } from '$lib/index.js'
</script>

<motion.div
    initial={{ opacity: 0, scale: 0 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{
        duration: 0.4,
        scale: { type: 'spring', visualDuration: 0.4, bounce: 0.5 }
    }}
    style="width: 100px; height: 100px; background-color: red; border-radius: 50%;"
    data-testid="motion-div"
/>
