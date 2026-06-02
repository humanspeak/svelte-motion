<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import PresenceDataProbe from './PresenceDataProbe.svelte'

    let { custom }: { custom?: number } = $props()
</script>

<AnimatePresence {custom}>
    <PresenceDataProbe />
</AnimatePresence>
