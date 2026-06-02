<script lang="ts">
    /**
     * Renders the current usePresenceData value for unit-like route checks.
     *
     * @component
     */
    import { usePresenceData } from '$lib'

    const data = $derived(usePresenceData<1 | -1>())
</script>

<output data-testid="presence-data-probe" data-value={data === undefined ? 'undefined' : data}>
    {data === undefined ? 'undefined' : data}
</output>
