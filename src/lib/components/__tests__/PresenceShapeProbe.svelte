<script lang="ts" module>
    import { usePresence, type UsePresenceState } from '$lib/utils/usePresence.svelte'

    // Module-scoped sinks (plan 017): the value `usePresence()` returned at
    // init, and one record per run of the destructuring `$effect`.
    type ShapeRecord = {
        isPresent: boolean
        hasCallback: boolean
        callback: (() => void) | null
    }
    let state: UsePresenceState | undefined
    let log: ShapeRecord[] = []
    export const getShapeState = (): UsePresenceState | undefined => state
    export const getShapeLog = (): ShapeRecord[] => log
    export const resetShape = (): void => {
        state = undefined
        log = []
    }
</script>

<script lang="ts">
    const presence = usePresence()
    state = presence

    $effect(() => {
        const [isPresent, safeToRemove] = presence
        log.push({
            isPresent,
            hasCallback: typeof safeToRemove === 'function',
            callback: safeToRemove
        })
    })
</script>

<div data-testid="shape-probe"></div>
