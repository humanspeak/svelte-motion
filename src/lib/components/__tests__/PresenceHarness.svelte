<script lang="ts">
    import PresenceChild from '$lib/components/PresenceChild.svelte'
    import PresenceProbe from '$lib/components/__tests__/PresenceProbe.svelte'

    let { present = true }: { present?: boolean } = $props()
</script>

<PresenceChild {present}>
    <PresenceProbe />
</PresenceChild>
