<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import { motion } from '$lib/motion'

    /**
     * A list of owned `AnimatePresence mode="popLayout"` boundaries, one per
     * item, so a test can remove one item and add another in the same update
     * (the #2348 toast-list case: "Remove first, add item").
     */
    let { items }: { items: { id: number; present: boolean }[] } = $props()
</script>

{#each items as item (item.id)}
    <AnimatePresence mode="popLayout" present={item.present}>
        {#snippet child()}
            <motion.div
                data-testid="item-{item.id}"
                style="width:50px;height:50px"
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
            />
        {/snippet}
    </AnimatePresence>
{/each}
