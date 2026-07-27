<script lang="ts">
    import type { Snippet } from 'svelte'
    import PresenceChild from '$lib/components/PresenceChild.svelte'
    import type { AnimatePresenceMode } from '$lib/types'
    import {
        createAnimatePresenceContext,
        setAnimatePresenceContext,
        setPresenceDepth
    } from '$lib/utils/presence'
    import { pwLog } from '$lib/utils/log'

    /**
     * Provide `AnimatePresence` context to descendants.
     *
     * Wrap content whose children may be conditionally rendered so exit
     * animations can run after teardown. When a motion element unmounts, a
     * styled clone is animated out before being removed from the DOM.
     *
     * Pass `present` with a named `child` snippet when AnimatePresence should
     * own the conditional rendering. This keeps the real DOM node mounted
     * until its exit completes instead of animating a clone.
     *
     * @prop children Legacy slotted content participating through clone exits.
     * @prop child Named snippet retained for a real-node exit. Requires `present`.
     * @prop present Whether the owned `child` snippet is present. Requires `child`.
     * @prop initial When false, children skip their enter animation on initial mount.
     * @prop custom Data forwarded to exiting dynamic variants.
     * @prop mode Controls enter/exit coordination: 'sync' (default), 'wait', or 'popLayout'.
     * @prop onExitComplete Optional callback invoked once all exits complete.
     */
    type SharedProps = {
        custom?: unknown
        initial?: boolean
        mode?: AnimatePresenceMode
        onExitComplete?: () => void
    }

    type Props = SharedProps &
        (
            | {
                  children?: Snippet
                  child?: never
                  present?: never
              }
            | {
                  children?: never
                  child: Snippet
                  present: boolean
              }
        )

    // `$props<T>()` is the removed Svelte 4-era form: Svelte 5's `$props()` takes
    // no type argument, so it resolved to `any` and these props were untyped.
    let {
        children,
        child,
        present,
        custom,
        initial = true,
        mode = 'sync',
        onExitComplete
    }: Props = $props()

    pwLog('[AnimatePresence] mounting', {
        initial,
        mode,
        hasOnExitComplete: !!onExitComplete
    })
    const context = createAnimatePresenceContext({
        initial,
        mode,
        onExitComplete,
        custom
    })
    setAnimatePresenceContext(context)

    // Initialize presence depth to 0 for direct children
    // Only direct children (depth 0) require explicit key props, matching Framer Motion behavior
    setPresenceDepth(0)

    $effect.pre(() => {
        context.setCustom(custom)
    })
</script>

<div class="animate-presence-container">
    {#if child}
        <PresenceChild present={present ?? true}>
            {@render child()}
        </PresenceChild>
    {:else}
        {@render children?.()}
    {/if}
</div>

<style>
    .animate-presence-container {
        display: contents;
    }
</style>
