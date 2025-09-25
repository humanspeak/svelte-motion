<script lang="ts">
    import type { Snippet } from 'svelte'
    import { createAnimatePresenceContext, setAnimatePresenceContext } from '$lib/utils/presence'

    /**
     * Provide `AnimatePresence` context to descendants.
     *
     * Wrap content whose children may be conditionally rendered so exit
     * animations can run after teardown. When a motion element unmounts, a
     * styled clone is animated out before being removed from the DOM.
     *
     * @prop children Slotted content participating in presence.
     * @prop onExitComplete Optional callback invoked once all exits complete.
     */
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
