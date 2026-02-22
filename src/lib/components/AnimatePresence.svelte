<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { AnimatePresenceMode } from '$lib/types'
    import {
        createAnimatePresenceContext,
        setAnimatePresenceContext,
        setPresenceDepth
    } from '$lib/utils/presence'
    import { createLayoutIdRegistry, setLayoutIdRegistry } from '$lib/utils/layoutId'
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
     * @prop mode Controls enter/exit coordination: 'sync' (default), 'wait', or 'popLayout'.
     * @prop onExitComplete Optional callback invoked once all exits complete.
     */
    const {
        children,
        initial = true,
        mode = 'sync',
        onExitComplete
    } = $props<{
        children?: Snippet
        initial?: boolean
        mode?: AnimatePresenceMode
        onExitComplete?: () => void
    }>()

    pwLog('[AnimatePresence] mounting', { initial, mode, hasOnExitComplete: !!onExitComplete })
    const context = createAnimatePresenceContext({ initial, mode, onExitComplete })
    setAnimatePresenceContext(context)

    // Provide a layoutId registry scoped to this AnimatePresence boundary
    const layoutIdRegistry = createLayoutIdRegistry()
    setLayoutIdRegistry(layoutIdRegistry)

    // Initialize presence depth to 0 for direct children
    // Only direct children (depth 0) require explicit key props, matching Framer Motion behavior
    setPresenceDepth(0)
</script>

<div class="animate-presence-container">
    {@render children?.()}
</div>

<style>
    .animate-presence-container {
        display: contents;
    }
</style>
