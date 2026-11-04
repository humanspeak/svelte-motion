<script lang="ts">
    import { useIsPresent } from '$lib/utils/usePresence.svelte'

    const isPresent = $derived(useIsPresent())
</script>

<div data-testid="is-present-probe" data-is-present={isPresent}></div>
