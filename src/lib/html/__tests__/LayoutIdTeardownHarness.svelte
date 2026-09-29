<script lang="ts">
    import { motion } from '$lib/motion'
    import TeardownProbe from './TeardownProbe.svelte'

    /**
     * Harness for plan 008 Step 1: a `layoutId` element inside `{#if}`. The
     * probe sits in the same block and records, from its own `$effect`
     * cleanup, whether the motion element is still attached to the document
     * when Svelte tears the block's effects down.
     */
    let {
        show = true,
        onTeardown
    }: {
        show?: boolean
        onTeardown?: (isConnected: boolean | undefined) => void
    } = $props()

    let el = $state<HTMLElement>()
</script>

{#if show}
    <motion.div layoutId="teardown-probe" bind:ref={el}>probe</motion.div>
    <TeardownProbe getElement={() => el} {onTeardown} />
{/if}
