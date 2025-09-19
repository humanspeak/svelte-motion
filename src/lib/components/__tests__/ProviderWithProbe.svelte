<script lang="ts">
    import Provider from '$lib/components/__tests__/Provider.svelte'
    import Probe from '$lib/components/__tests__/Probe.svelte'
    export let transition: { duration?: number } = { duration: 0.3 }
</script>

<Provider {transition}>
    <Probe />
</Provider>
