<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'
</script>

<motion.button
    class="my-4 rounded-md border border-border bg-blue-300 px-4 py-2 text-text-primary"
    animate={{ opacity: 1 }}
    initial={{ opacity: 0 }}
    transition={{ duration: 0.6 }}
>
    Animated button
</motion.button>
