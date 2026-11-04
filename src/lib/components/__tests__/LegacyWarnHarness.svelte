<script lang="ts">
    import PresenceChild from '$lib/components/PresenceChild.svelte'
    import LegacyPresenceProbe from '$lib/components/__tests__/LegacyPresenceProbe.svelte'

    // Two wrappers, each with two legacy consumers (plan 017): the dev
    // warning fires once per wrapper.
    let { present = true }: { present?: boolean } = $props()
</script>

<PresenceChild {present}>
    <LegacyPresenceProbe />
    <LegacyPresenceProbe />
</PresenceChild>
<PresenceChild {present}>
    <LegacyPresenceProbe />
    <LegacyPresenceProbe />
</PresenceChild>
