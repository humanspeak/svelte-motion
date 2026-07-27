<script lang="ts">
    /**
     * THROWAWAY SPIKE — Candidate B helper.
     *
     * Sits INSIDE `<PresenceChild>` and re-publishes the presence-child context
     * with a wrapped `safeToRemove`, so the list wrapper learns PER-ITEM exit
     * completion. The product `PresenceChild` has no `onExitComplete` prop
     * today; this proxy is how the spike answers Candidate B's questions with
     * ZERO changes to `src/lib` (the real implementation would add that prop —
     * see the spike report's implementation outline).
     *
     * Also implements `popLayout` on the REAL node using the existing exported
     * measurement helpers (`measurePopLayoutSnapshot` / `resolvePopLayoutStyles`
     * from `$lib/utils/presence`) — no clone, no placeholder.
     */
    import type { Snippet } from 'svelte'
    import {
        getPresenceChildContext,
        measurePopLayoutSnapshot,
        resolvePopLayoutStyles,
        setPresenceChildContext
    } from '$lib/utils/presence'
    import { visualElementStore } from 'motion-dom'
    import { spikeLog } from './spike-log'

    type Props = {
        id: string
        popLayout?: boolean
        onExitComplete: (id: string) => void
        children?: Snippet
    }
    const { id, popLayout = false, onExitComplete, children }: Props = $props()

    const inner = getPresenceChildContext()
    let host: HTMLElement | undefined = $state()
    let popped = false

    spikeLog('probe-init', { id, hasInnerContext: !!inner })

    /** One exit completion: settle the wrapper, then let the list drop the item. */
    const completeExit = () => {
        spikeLog('item-exit-complete', { id })
        inner?.safeToRemove()
        onExitComplete(id)
    }

    /**
     * MEASURED GAP (see candidate-b sections 5/6): the shipped container calls
     * `visualElement.updateFeatures()` only from its mount effect
     * (`_MotionContainer.svelte:2076`) and passes the presence context inside
     * `untrack()` (`:2123-2124`). `VisualElement.update()` does NOT run features
     * (motion-dom `VisualElement.mjs:370-393`; only `updateFeatures()`
     * `:317-345` does), so `ExitAnimationFeature.update()` is never called after
     * mount and a `motion.*` child of `PresenceChild` never exits.
     *
     * The spike cannot patch `src/lib`, so it emulates the missing call here —
     * exactly the two lines upstream runs every render
     * (`use-visual-element.ts:147-148`). This is the ONE product change
     * Candidate B needs; everything downstream of it is existing machinery.
     */
    const pumpExitFeature = (isPresent: boolean) => {
        const node = host?.firstElementChild
        if (!node) return
        const ve = visualElementStore.get(node)
        if (!ve) {
            spikeLog('probe-no-visual-element', { id })
            return
        }
        // Fresh object per call: `prevPresenceContext` is the flip detector
        // (visual-element-core 004 guard report).
        ve.update(ve.getProps(), {
            id: `spike-${id}`,
            isPresent,
            register: () => () => {},
            onExitComplete: () => completeExit()
        } as never)
        ve.updateFeatures()
        spikeLog('probe-pumped-features', { id, isPresent })
    }

    $effect(() => {
        const present = inner?.isPresent ?? true
        spikeLog('probe-isPresent', { id, isPresent: present })
        if (!present) pumpExitFeature(false)
    })

    setPresenceChildContext({
        get isPresent() {
            return inner?.isPresent ?? true
        },
        get safeToRemove() {
            return completeExit
        }
    })

    // popLayout: when the wrapper flips to "exiting", take the real node out of
    // layout flow so the surviving siblings collapse immediately.
    $effect.pre(() => {
        const present = inner?.isPresent ?? true
        if (present || popped || !popLayout) return
        const node = host?.firstElementChild as HTMLElement | null
        if (!node) return
        popped = true
        const snapshot = measurePopLayoutSnapshot(node)
        const styles = resolvePopLayoutStyles(snapshot)
        Object.assign(node.style, styles)
        spikeLog('poplayout-applied', { id, width: snapshot.width, height: snapshot.height })
    })
</script>

<div bind:this={host} style="display: contents" data-spike-probe={id}>
    {@render children?.()}
</div>
