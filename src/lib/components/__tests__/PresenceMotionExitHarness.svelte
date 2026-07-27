<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import PresenceChild from '$lib/components/PresenceChild.svelte'
    import { motion } from '$lib/motion'

    let {
        present = true,
        onExitComplete
    }: {
        present?: boolean
        onExitComplete?: () => void
    } = $props()
</script>

<AnimatePresence {onExitComplete}>
    <PresenceChild {present}>
        <motion.div
            data-testid="presence-motion-child"
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.05 }}
        >
            Held motion child
        </motion.div>
    </PresenceChild>
</AnimatePresence>
