<script lang="ts">
    import Provider from '$lib/components/__tests__/Provider.svelte'
    import Probe from '$lib/components/__tests__/Probe.svelte'
    let { transition = { duration: 0.3 } }: { transition?: { duration?: number } } = $props()
</script>

<Provider {transition}>
    <Probe />
</Provider>
