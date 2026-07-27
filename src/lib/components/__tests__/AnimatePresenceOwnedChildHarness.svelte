<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import { motion } from '$lib/motion'

    let {
        present,
        onExitComplete
    }: {
        present: boolean
        onExitComplete?: () => void
    } = $props()
</script>

<AnimatePresence {present} {onExitComplete}>
    {#snippet child()}
        <motion.div
            data-testid="owned-presence-child"
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.05 }}
        >
            Owned child
        </motion.div>
    {/snippet}
</AnimatePresence>
