<script module lang="ts">
    const exitTransition = { opacity: 0, transition: { duration: 0.05 } }
</script>

<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import LayoutGroup from '$lib/components/LayoutGroup.svelte'
    import { motion } from '$lib/motion'

    /**
     * Plan 015b A2.1: a wait-mode label swap inside a held `layout` parent
     * (`#held`, the `.state` span of the layout-button page's ModeButton).
     * `copied` swaps the label; `layoutGroup` wraps everything in one
     * `LayoutGroup`.
     */
    let { copied = false, layoutGroup = false }: { copied?: boolean; layoutGroup?: boolean } =
        $props()
</script>

{#snippet held()}
    <motion.span id="held" data-svelte-motion-layout layout="position">
        <AnimatePresence initial={false} mode="wait">
            {#if copied}
                <motion.span key="copied" id="label-copied" exit={exitTransition} />
            {:else}
                <motion.span key="copy" id="label-copy" exit={exitTransition} />
            {/if}
        </AnimatePresence>
    </motion.span>
{/snippet}

{#if layoutGroup}
    <LayoutGroup>
        {@render held()}
    </LayoutGroup>
{:else}
    {@render held()}
{/if}
