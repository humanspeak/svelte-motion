<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import { motion } from '$lib/motion'

    /**
     * Plan 012 (U11): a clone-syntax swap of two `layoutId` siblings, for
     * `presenceSharedLayout.spec.ts`.
     *
     * - `which`: the shown sibling, `#a` or `#b` (`null` shows neither).
     * - `split`: two separate `{#if}` blocks instead of one `{#if}…{:else}`.
     * - `nested`: `#a` holds a nested `motion.div` with `layoutId="inner"`.
     * - `clearId`: drops `#a`'s `layoutId`, for a removal in the same flush.
     * - `boxWidth`: renders only a `layout` `#box` that wide instead, with the
     *   `onLayoutAnimationStart` / `onLayoutAnimationComplete` callbacks.
     */
    let {
        which = 'a',
        split = false,
        nested = false,
        clearId = false,
        boxWidth,
        onLayoutAnimationStart,
        onLayoutAnimationComplete
    }: {
        which?: 'a' | 'b' | null
        split?: boolean
        nested?: boolean
        clearId?: boolean
        boxWidth?: number
        onLayoutAnimationStart?: () => void
        onLayoutAnimationComplete?: () => void
    } = $props()
</script>

{#snippet a()}
    <motion.div key="a" id="a" layoutId={clearId ? undefined : 'shared'}>
        {#if nested}
            <motion.div id="a-inner" layoutId="inner" />
        {/if}
    </motion.div>
{/snippet}
{#snippet b()}
    <motion.div key="b" id="b" layoutId="shared" />
{/snippet}

{#if boxWidth !== undefined}
    <motion.div
        id="box"
        layout
        style="width: {boxWidth}px; height: 50px;"
        transition={{ duration: 0.05 }}
        {onLayoutAnimationStart}
        {onLayoutAnimationComplete}
    />
{:else}
    <AnimatePresence>
        {#if split}
            {#if which === 'a'}{@render a()}{/if}
            {#if which === 'b'}{@render b()}{/if}
        {:else if which === 'a'}
            {@render a()}
        {:else if which === 'b'}
            {@render b()}
        {/if}
    </AnimatePresence>
{/if}
