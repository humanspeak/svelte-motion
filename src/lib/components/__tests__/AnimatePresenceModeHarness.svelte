<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import type { AnimatePresenceMode } from '$lib/types'
    import PresenceModeProbe from './PresenceModeProbe.svelte'

    let { mode }: { mode: AnimatePresenceMode } = $props()
</script>

<AnimatePresence {mode}>
    <PresenceModeProbe />
</AnimatePresence>
