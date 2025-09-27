<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'
</script>

<motion.button
    class="text-text-primary-muted my-4 rounded-md border border-border bg-green-500 px-4 py-2"
    whileHover={{ scale: 1.2 }}
    whileTap={{ scale: 0.8 }}
    transition={{ duration: 0.6 }}
>
    Animated button
</motion.button>
