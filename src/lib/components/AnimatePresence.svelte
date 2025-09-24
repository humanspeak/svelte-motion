<script lang="ts">
    import type { Snippet } from 'svelte'
    import { createAnimatePresenceContext, setAnimatePresenceContext } from '$lib/utils/presence'

    const { children, onExitComplete } = $props<{
        children?: Snippet
        onExitComplete?: () => void
    }>()

    const context = createAnimatePresenceContext({ onExitComplete })
    setAnimatePresenceContext(context)
</script>

<div class="animate-presence-container">
    {@render children?.()}
</div>

<style>
    .animate-presence-container {
        position: relative;
    }
</style>
