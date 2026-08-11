<script>
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'
</script>

<AnimatePresence>
    <motion.object key="object" data-regression="optimized-object">object</motion.object>

    <motion.svg key="svg">
        <motion.set data-regression="optimized-set" />
    </motion.svg>
</AnimatePresence>
