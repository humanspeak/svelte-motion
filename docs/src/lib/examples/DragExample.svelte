<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'
</script>

<div class="flex flex-col items-center gap-4">
    <p class="text-sm text-text-muted">Drag the box around</p>
    <motion.div
        drag
        whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        class="size-24 cursor-grab rounded-xl bg-violet-400"
    />
</div>
