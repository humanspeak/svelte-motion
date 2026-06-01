<script lang="ts">
    import { usePresenceData } from '$lib/utils/usePresence'

    const data = $derived(usePresenceData<number>())
</script>

<div data-testid="presence-data-probe" data-value={data === undefined ? 'undefined' : data}>
    {data}
</div>
