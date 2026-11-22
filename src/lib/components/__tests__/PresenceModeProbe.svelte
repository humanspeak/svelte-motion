<script lang="ts" module>
    import { getAnimatePresenceContext, type AnimatePresenceContext } from '$lib/utils/presence'

    let context: AnimatePresenceContext | undefined
    let mounts = 0
    let effectRuns = 0

    /** The mode the probe's AnimatePresence context reports now. */
    export const readPresenceMode = () => context?.mode
    /** How many times the probe mounted. */
    export const getPresenceModeProbeMounts = () => mounts
    /** How many times the probe's effect that reads `context.mode` ran. */
    export const getPresenceModeEffectRuns = () => effectRuns
    /** Reset the module state between tests. */
    export const resetPresenceModeProbe = () => {
        context = undefined
        mounts = 0
        effectRuns = 0
    }
</script>

<script lang="ts">
    import { onMount } from 'svelte'

    context = getAnimatePresenceContext()
    onMount(() => {
        mounts += 1
    })
    $effect(() => {
        void context?.mode
        effectRuns += 1
    })
</script>

<span data-testid="presence-mode-probe"></span>
