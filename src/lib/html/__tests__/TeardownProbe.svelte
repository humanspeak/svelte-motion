<script lang="ts">
    /**
     * Records `element.isConnected` from an `$effect` cleanup, i.e. at the
     * moment Svelte runs child effect teardowns for the enclosing block.
     */
    let {
        getElement,
        onTeardown
    }: {
        getElement: () => HTMLElement | undefined
        onTeardown?: (isConnected: boolean | undefined) => void
    } = $props()

    $effect(() => {
        const element = getElement()
        return () => onTeardown?.(element?.isConnected)
    })
</script>
