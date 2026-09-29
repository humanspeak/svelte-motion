<script lang="ts">
    import LayoutGroup from '$lib/components/LayoutGroup.svelte'
    import LayoutGroupProbe from './LayoutGroupProbe.svelte'

    /**
     * Renders one nested `<LayoutGroup>` per entry of `ids` (outermost
     * first) with a `LayoutGroupProbe` at the innermost level. Entries may
     * be `undefined` to express upstream's `<LayoutGroup id={undefined}>`
     * layers, which `LayoutGroupProbeHarness` can't.
     *
     * `inherits[i]` sets level `i`'s `inherit` prop (omitted → default).
     * With `probeEachLevel`, every level also renders a probe with test id
     * `layout-group-probe-<i>`, so specs can compare node-group identity
     * between a group and its nested groups.
     */
    let {
        ids,
        inherits = [],
        probeEachLevel = false
    }: {
        ids: Array<string | undefined>
        inherits?: Array<boolean | 'id' | undefined>
        probeEachLevel?: boolean
    } = $props()
</script>

{#snippet level(index: number)}
    {#if index < ids.length}
        <LayoutGroup id={ids[index]} inherit={inherits[index] ?? true}>
            {#if probeEachLevel}
                <LayoutGroupProbe testId="layout-group-probe-{index}" />
            {/if}
            {@render level(index + 1)}
        </LayoutGroup>
    {:else}
        <LayoutGroupProbe />
    {/if}
{/snippet}

{@render level(0)}
