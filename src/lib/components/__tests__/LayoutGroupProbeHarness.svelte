<script lang="ts">
    import LayoutGroup from '$lib/components/LayoutGroup.svelte'
    import LayoutGroupProbe from './LayoutGroupProbe.svelte'

    let {
        outer,
        inner,
        inherit = true
    }: {
        outer?: string
        inner?: string
        inherit?: boolean | 'id'
    } = $props()
</script>

{#if outer === undefined && inner === undefined}
    <LayoutGroupProbe />
{:else if inner === undefined}
    <LayoutGroup id={outer}>
        <LayoutGroupProbe />
    </LayoutGroup>
{:else}
    <LayoutGroup id={outer}>
        <LayoutGroup id={inner} {inherit}>
            <LayoutGroupProbe />
        </LayoutGroup>
    </LayoutGroup>
{/if}
