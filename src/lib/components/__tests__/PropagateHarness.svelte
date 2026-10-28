<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import { motion } from '$lib/motion'

    /**
     * An owned outer exit (`present` + `child`) holding a nested
     * `AnimatePresence`, for `propagate`. Port of the component in upstream
     * `AnimatePresence.test.tsx` "nested AnimatePresence should animate exit
     * when propagate is true" and `animate-presence-propagate-empty.tsx`
     * (@ v14.7.1).
     *
     * `form`: `'owned'` nests `<AnimatePresence present>` with a `child`
     * snippet, `'legacy'` nests the slotted form with an `{#if innerShown}`
     * child, `'empty'` nests a boundary with nothing inside.
     */
    let {
        outer,
        form = 'owned',
        propagate = false,
        innerShown = true,
        onExitComplete
    }: {
        outer: boolean
        form?: 'owned' | 'legacy' | 'empty'
        propagate?: boolean
        innerShown?: boolean
        onExitComplete?: () => void
    } = $props()
</script>

<AnimatePresence present={outer} {onExitComplete}>
    {#snippet child()}
        <motion.div data-testid="outer" exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
            {#if form === 'owned'}
                <AnimatePresence {propagate} present={true}>
                    {#snippet child()}
                        <motion.div data-testid="inner" exit={{ opacity: 0 }} />
                    {/snippet}
                </AnimatePresence>
            {:else if form === 'legacy'}
                <AnimatePresence {propagate}>
                    {#if innerShown}
                        <motion.div key="inner" data-testid="inner" exit={{ opacity: 0 }} />
                    {/if}
                </AnimatePresence>
            {:else}
                <AnimatePresence {propagate} />
            {/if}
        </motion.div>
    {/snippet}
</AnimatePresence>
