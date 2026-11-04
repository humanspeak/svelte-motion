<script lang="ts">
    import type { VisualElement } from 'motion-dom'
    import { onDestroy, untrack, type Snippet } from 'svelte'
    import PresenceChild from '$lib/components/PresenceChild.svelte'
    import { getLayoutGroupContext } from '$lib/components/layoutGroup.context'
    import type { AnimatePresenceMode } from '$lib/types'
    import { createPresenceExitRegistry } from '$lib/utils/presenceExitRegistry'
    import {
        createAnimatePresenceContext,
        getPresenceChildContext,
        setAnimatePresenceContext,
        setPresenceChildContext,
        setPresenceDepth,
        type PopLayoutAnchorX,
        type PresenceChildContext,
        type PopLayoutAnchorY
    } from '$lib/utils/presence'
    import { pwLog } from '$lib/utils/log'

    /**
     * Provide `AnimatePresence` context to descendants.
     *
     * Wrap content whose children may be conditionally rendered so exit
     * animations can run after teardown. When a motion element unmounts, a
     * styled clone is animated out before being removed from the DOM.
     * Removing this boundary cancels its exits and removes clones immediately.
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
     * @prop anchorX Set whether to anchor the x position of the exiting element
     *     to the left or right when using `mode="popLayout"`. Use `'right'` for
     *     elements originally positioned with `right: 0`. Defaults to `'left'`.
     * @prop anchorY Set whether to anchor the y position of the exiting element
     *     to the top or bottom when using `mode="popLayout"`. Use `'bottom'` for
     *     elements originally positioned with `bottom: 0`. Defaults to `'top'`.
     * @prop root Root element to use when injecting styles, used when
     *     `mode="popLayout"`. Defaults to the head of the document the element
     *     is rendered in, but can be overridden, e.g. for use in shadow DOM.
     * @prop propagate If true, the AnimatePresence component will propagate
     *     parent exit animations to its children. Needs an owned parent exit (a
     *     `present` + `child` boundary or a `PresenceChild`): a clone exit
     *     replaces the parent's subtree with a static copy, so nothing nested
     *     is left to animate. Defaults to `false`, so a nested boundary is
     *     independent of its parent's exit.
     */
    type SharedProps = {
        custom?: unknown
        initial?: boolean
        mode?: AnimatePresenceMode
        onExitComplete?: () => void
        anchorX?: PopLayoutAnchorX
        anchorY?: PopLayoutAnchorY
        root?: HTMLElement | ShadowRoot
        propagate?: boolean
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
        onExitComplete,
        anchorX = 'left',
        anchorY = 'top',
        root,
        propagate = false
    }: Props = $props()

    // ── propagate (upstream AnimatePresence/index.tsx @ v14.7.1, lines 58,
    // 70-71, 95-99, 213-217, 246; use-presence.ts:40-65) ──────────────────
    // The presence this boundary sits in, when it is inside an owned exit.
    const parentPresence = getPresenceChildContext()
    const presenceId = $props.id()
    // Read once: which context the legacy children see is fixed at mount.
    const propagates = untrack(() => propagate) && !!parentPresence
    const isLegacy = untrack(() => !child)

    /** Complete this boundary's part in the parent's current exit cycle. */
    const releaseParent = () => {
        // Read at call time: the parent's callback is versioned per cycle.
        parentPresence?.onExitComplete(presenceId)
    }
    const isParentExiting = () => propagates && parentPresence?.isPresent === false

    // Only a propagating boundary holds its parent's exit (upstream
    // `usePresence(propagate)` only subscribes when it propagates).
    if (propagates) {
        const unregister = parentPresence!.register(presenceId)
        onDestroy(unregister)
    }

    if (isLegacy && !propagates) {
        // Children of a non-propagating boundary don't exit with the parent:
        // they get their own (clone) exits from this boundary instead.
        setPresenceChildContext(undefined as never)
    } else if (isLegacy && parentPresence) {
        // Propagating legacy boundary: its children follow the parent's
        // presence and exit as real nodes, and only this boundary is the
        // parent's participant. Its own registry tracks them, so it can
        // release the parent once they have all exited.
        const innerRegistry = createPresenceExitRegistry()
        let completeInner: ReturnType<typeof innerRegistry.begin> = () => {}
        // motion-dom types the node as `any`; the registry takes a VisualElement.
        const register: PresenceChildContext['register'] = (id, node?: VisualElement) =>
            innerRegistry.register(id, node)
        setPresenceChildContext({
            get isPresent() {
                return parentPresence.isPresent
            },
            safeToRemove: releaseParent,
            register,
            get onExitComplete() {
                return completeInner
            },
            propagated: true
        })
        let wasParentPresent = true
        $effect.pre(() => {
            const parentPresent = parentPresence.isPresent
            if (wasParentPresent && !parentPresent) {
                // Nothing to exit: release at once, as upstream's post-commit
                // effect does (PresenceChild.tsx:104-113 @ v14.7.1).
                completeInner = innerRegistry.begin(releaseParent)
                innerRegistry.completeIfEmpty()
            } else if (!wasParentPresent && parentPresent) {
                innerRegistry.cancel()
                completeInner = () => {}
            }
            wasParentPresent = parentPresent
        })
    }

    pwLog('[AnimatePresence] mounting', {
        initial,
        mode,
        hasOnExitComplete: !!onExitComplete
    })
    const context = createAnimatePresenceContext({
        initial,
        mode,
        onExitComplete: () => {
            onExitComplete?.()
            // Owned form: the held child finished exiting with the parent.
            if (isParentExiting()) releaseParent()
        },
        // Upstream re-renders the surrounding LayoutGroup once every exit
        // completes, so its members animate into the freed space.
        forceRender: getLayoutGroupContext()?.forceRender,
        custom,
        // A getter, so the latest props are read at pop time (upstream passes
        // them to every PopChild on each render).
        getPopLayoutOptions: () => ({ anchorX, anchorY, root })
    })
    setAnimatePresenceContext(context)
    onDestroy(context.dispose)

    // Initialize presence depth to 0 for direct children
    // Only direct children (depth 0) require explicit key props, matching Framer Motion behavior
    setPresenceDepth(0)

    $effect.pre(() => {
        context.setCustom(custom)
    })

    // Owned form whose child was already gone when the parent started
    // exiting: nothing will exit, so release the parent at once (upstream's
    // `propagate && !isParentPresent && !renderedChildren.length`).
    $effect(() => {
        if (!isLegacy && isParentExiting() && present === false) releaseParent()
    })

    // Owned form: a propagating boundary's child leaves with the parent.
    const ownedPresent = $derived(
        (present ?? true) && (!propagates || (parentPresence?.isPresent ?? true))
    )
</script>

<!-- `data-propagate` (plan 012): an exiting ancestor's clone walk passes its
     exit to this boundary's children only when it propagates. -->
<div class="animate-presence-container" data-propagate={propagate || undefined}>
    {#if child}
        <PresenceChild present={ownedPresent}>
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
