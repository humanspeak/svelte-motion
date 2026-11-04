<script lang="ts">
    import PresenceChild from '$lib/components/PresenceChild.svelte'
    import LegacyPresenceProbe from '$lib/components/__tests__/LegacyPresenceProbe.svelte'
    import PresenceProbe from '$lib/components/__tests__/PresenceProbe.svelte'
    import PresenceShapeProbe from '$lib/components/__tests__/PresenceShapeProbe.svelte'

    let {
        present = true,
        legacy = false,
        shape = false,
        count = 1
    }: { present?: boolean; legacy?: boolean; shape?: boolean; count?: number } = $props()
</script>

<PresenceChild {present}>
    {#each { length: count }, index (index)}
        {#if shape}
            <PresenceShapeProbe />
        {:else if legacy}
            <LegacyPresenceProbe />
        {:else}
            <PresenceProbe />
        {/if}
    {/each}
</PresenceChild>
