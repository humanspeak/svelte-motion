<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import PresenceChild from '$lib/components/PresenceChild.svelte'

    // Two plain-content wrappers in `mode="wait"` (plan 017): nothing
    // registers with either, so the leaver completes at once and the
    // entrant comes in.
    let { slot = 'a', onExitComplete }: { slot?: 'a' | 'b'; onExitComplete?: () => void } = $props()
</script>

<AnimatePresence mode="wait" {onExitComplete}>
    <PresenceChild present={slot === 'a'}>
        <div data-testid="slot-a">A</div>
    </PresenceChild>
    <PresenceChild present={slot === 'b'}>
        <div data-testid="slot-b">B</div>
    </PresenceChild>
</AnimatePresence>
