<script lang="ts">
    import { motion } from '$lib/motion'

    /**
     * Harness for plan 007 amendment A1 (#1935): a `layoutId` element that
     * moves between two slots by conditional rendering, optionally with a
     * `layout` type, as the tabs' underline does.
     */
    let { selected, layout }: { selected: 'a' | 'b'; layout?: boolean | 'position' | 'size' } =
        $props()
</script>

{#if selected === 'a'}
    <motion.div id="a" layoutId="a1-handoff" {layout} />
{:else}
    <motion.div id="b" layoutId="a1-handoff" {layout} />
{/if}
