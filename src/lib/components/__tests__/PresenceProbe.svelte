<script lang="ts">
    import { useIsPresent, usePresence } from '$lib/utils/usePresence'

    const isPresent = $derived(useIsPresent())
    const presence = $derived(usePresence())
    const [tupleIsPresent, safeToRemove] = $derived(presence)
</script>

<div
    data-testid="probe"
    data-is-present={isPresent}
    data-tuple-is-present={tupleIsPresent}
    data-tuple-has-callback={safeToRemove !== null}
    onclick={() => safeToRemove?.()}
    onkeydown={(e) => e.key === 'Enter' && safeToRemove?.()}
    role="button"
    tabindex="0"
></div>
