<script lang="ts" module>
    // Module-scoped sink so the test can read out the cycle-A callback after a
    // canceled exit, then invoke it from cycle B and assert it does NOT
    // complete the wrong cycle.
    let captured: (() => void) | null = null
    export const getCapturedSafeToRemove = (): (() => void) | null => captured
    export const resetCapturedSafeToRemove = (): void => {
        captured = null
    }
</script>

<script lang="ts">
    import { usePresence } from '$lib/utils/usePresence'

    const presence = $derived(usePresence())

    $effect(() => {
        const [, safeToRemove] = presence
        if (safeToRemove) captured = safeToRemove
    })
</script>

<div data-testid="probe" data-is-present={presence[0]}></div>
