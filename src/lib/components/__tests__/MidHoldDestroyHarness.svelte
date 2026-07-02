<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import PresenceChild from '$lib/components/PresenceChild.svelte'

    // Reproduces the mid-hold unmount: `inner` flips false to start a
    // held exit (the child never calls safeToRemove), then `outer`
    // flips false to destroy the PresenceChild while it is holding.
    let {
        outer = true,
        inner = true,
        onExitComplete
    }: { outer?: boolean; inner?: boolean; onExitComplete?: () => void } = $props()
</script>

<AnimatePresence mode="wait" {onExitComplete}>
    {#if outer}
        <PresenceChild present={inner}>
            <div data-testid="held-child">held</div>
        </PresenceChild>
    {/if}
</AnimatePresence>
