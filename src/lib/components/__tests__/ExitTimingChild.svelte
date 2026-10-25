<script lang="ts">
    import { onDestroy } from 'svelte'

    /**
     * Logs `'cleanup'` into the shared `log` when it unmounts, so specs can
     * order the child's teardown against `AnimatePresence`'s `onExitComplete`.
     */
    let { log }: { log: string[] } = $props()

    onDestroy(() => log.push('cleanup'))
</script>

<div id="exit-timing-child" data-testid="exit-timing-child">Exit timing child</div>
