<script lang="ts">
    import LayoutGroup from '$lib/components/LayoutGroup.svelte'
    import LayoutGroupProbe from './LayoutGroupProbe.svelte'

    /**
     * Renders one nested `<LayoutGroup>` per entry of `ids` (outermost
     * first) with a `LayoutGroupProbe` at the innermost level. Entries may
     * be `undefined` to express upstream's `<LayoutGroup id={undefined}>`
     * layers, which `LayoutGroupProbeHarness` can't.
     */
    let { ids }: { ids: Array<string | undefined> } = $props()
</script>

{#snippet level(index: number)}
    {#if index < ids.length}
        <LayoutGroup id={ids[index]}>
            {@render level(index + 1)}
        </LayoutGroup>
    {:else}
        <LayoutGroupProbe />
    {/if}
{/snippet}

{@render level(0)}
