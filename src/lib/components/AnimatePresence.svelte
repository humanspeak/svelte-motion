<script lang="ts">
    import type { Snippet } from 'svelte'
    import { createAnimatePresenceContext, setAnimatePresenceContext } from '$lib/utils/presence'
    import { pwLog } from '$lib/utils/log'

    /**
     * Provide `AnimatePresence` context to descendants.
     *
     * Wrap content whose children may be conditionally rendered so exit
     * animations can run after teardown. When a motion element unmounts, a
     * styled clone is animated out before being removed from the DOM.
     *
     * @prop children Slotted content participating in presence.
     * @prop initial When false, children skip their enter animation on initial mount.
     * @prop onExitComplete Optional callback invoked once all exits complete.
     */
    const {
        children,
        initial = true,
        onExitComplete
    } = $props<{
        children?: Snippet
        initial?: boolean
        onExitComplete?: () => void
    }>()

    pwLog('[AnimatePresence] mounting', { initial, hasOnExitComplete: !!onExitComplete })
    const context = createAnimatePresenceContext({ initial, onExitComplete })
    setAnimatePresenceContext(context)
</script>

<div class="animate-presence-container">
    {@render children?.()}
</div>

<style>
    .animate-presence-container {
        display: contents;
    }
</style>
