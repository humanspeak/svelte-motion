<script>
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'
</script>

<AnimatePresence>
    <motion.object key="object" data-regression="object">object</motion.object>

    <motion.svg key="svg">
        <motion.set data-regression="set" />
    </motion.svg>
</AnimatePresence>
