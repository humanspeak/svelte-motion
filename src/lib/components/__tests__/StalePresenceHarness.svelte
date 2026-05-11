<script lang="ts">
    import PresenceChild from '$lib/components/PresenceChild.svelte'
    import StalePresenceProbe from '$lib/components/__tests__/StalePresenceProbe.svelte'

    let { present = true }: { present?: boolean } = $props()
</script>

<PresenceChild {present}>
    <StalePresenceProbe />
</PresenceChild>
