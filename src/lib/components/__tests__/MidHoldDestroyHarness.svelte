<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import PresenceChild from '$lib/components/PresenceChild.svelte'
    import PresenceProbe from '$lib/components/__tests__/PresenceProbe.svelte'

    // Reproduces the mid-hold unmount: `inner` flips false to start a
    // held exit, then `outer` flips false to destroy the PresenceChild while
    // it is holding. The hold is the probe's registered `usePresence()`
    // participant, which never calls safeToRemove. With `probe: false`
    // nothing registers, so the wrapper leaves at once (plan 017).
    let {
        outer = true,
        inner = true,
        probe = true,
        onExitComplete
    }: {
        outer?: boolean
        inner?: boolean
        probe?: boolean
        onExitComplete?: () => void
    } = $props()
</script>

<AnimatePresence mode="wait" {onExitComplete}>
    {#if outer}
        <PresenceChild present={inner}>
            <div data-testid="held-child">held</div>
            {#if probe}<PresenceProbe />{/if}
        </PresenceChild>
    {/if}
</AnimatePresence>
