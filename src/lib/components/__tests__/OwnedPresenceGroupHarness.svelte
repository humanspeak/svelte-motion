<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import PresenceChild from '$lib/components/PresenceChild.svelte'
    import PresenceProbe from '$lib/components/__tests__/PresenceProbe.svelte'
    import { motion } from '$lib/motion'

    let {
        present = true,
        onExitComplete,
        fastPresent = true,
        slowPresent = true,
        manual = false,
        noExit = false,
        nested = false,
        mode = 'sync'
    }: {
        present?: boolean
        fastPresent?: boolean
        slowPresent?: boolean
        manual?: boolean
        noExit?: boolean
        nested?: boolean
        mode?: 'sync' | 'wait'
        onExitComplete?: () => void
    } = $props()
</script>

<AnimatePresence {present} {onExitComplete} {mode}>
    {#snippet child()}
        <div data-testid="owned-group">
            {#if manual}<PresenceProbe />{/if}
            {#if noExit}<motion.div data-testid="owned-no-exit" animate={{ opacity: 1 }}
                    >No exit</motion.div
                >{/if}
            {#if nested}<PresenceChild present={true}
                    ><motion.div
                        data-testid="nested-motion"
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}>Nested boundary</motion.div
                    ></PresenceChild
                >{/if}
            {#if fastPresent}
                <motion.div data-testid="owned-fast" animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    Fast
                </motion.div>
            {/if}
            {#if slowPresent}
                <motion.div data-testid="owned-slow" animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    Slow
                </motion.div>
            {/if}
        </div>
    {/snippet}
</AnimatePresence>
