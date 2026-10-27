<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import { motion } from '$lib/motion'

    /**
     * `count` sibling owned `AnimatePresence mode="popLayout"` boundaries, each
     * holding one 50×50 motion element (`data-testid="item"`). Port of the
     * component in upstream `pop-child-container-move.test.tsx` @ v14.7.1.
     */
    let {
        present,
        count = 1,
        anchorY,
        root
    }: {
        present: boolean
        count?: number
        anchorY?: 'top' | 'bottom'
        root?: HTMLElement | ShadowRoot
    } = $props()
</script>

{#each Array.from({ length: count }, (_, index) => index) as index (index)}
    <AnimatePresence mode="popLayout" {present} {anchorY} {root}>
        {#snippet child()}
            <motion.div
                data-testid="item"
                style="width:50px;height:50px"
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
            />
        {/snippet}
    </AnimatePresence>
{/each}
