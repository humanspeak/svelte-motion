<script lang="ts" module>
    // Unique per popped element across every PresenceChild on the page.
    let popIdCounter = 0
</script>

<script lang="ts">
    import { onDestroy, type Snippet } from 'svelte'
    import { createPresenceExitRegistry } from '$lib/utils/presenceExitRegistry'
    import type { PresenceContextProps } from 'motion-dom'
    import {
        createPopLayoutPointCache,
        getAnimatePresenceContext,
        getPresenceDepth,
        measurePopLayoutSnapshot,
        resolvePopLayoutStyles,
        schedulePopLayoutCorrection,
        setPresenceChildContext,
        setPresenceDepth
    } from '$lib/utils/presence'

    /**
     * Holds its `children` snippet rendered until the consumer signals the
     * exit is complete via `safeToRemove()`, or all registered motion exits
     * finish. Manual removal releases the entire wrapper. Lets a child run its own (non-
     * `motion.*`) exit animation — fade via CSS transition, canvas effect,
     * GSAP, etc — while still participating in `AnimatePresence`'s
     * `onExitComplete` accounting and `mode='wait'` enter blocking.
     *
     * Children read `useIsPresent()` or `usePresence()` to observe the
     * exit-phase flip.
     *
     * @prop present Bind to the same boolean that conditionally rendered this
     *     wrapper. When it flips to `false`, the wrapper holds children
     *     mounted with `isPresent = false` until `safeToRemove` fires.
     * @prop children Snippet rendered while present or held.
     */
    type Props = {
        present?: boolean
        children?: Snippet
    }

    // `$props<T>()` is the removed Svelte 4-era form: Svelte 5's `$props()` takes
    // no type argument, so it resolved to `any` and these props were untyped.
    const { present = true, children }: Props = $props()

    const animatePresence = getAnimatePresenceContext()
    const presenceDepth = getPresenceDepth()

    // Descendants of PresenceChild are no longer at depth 0, so any motion.*
    // children inside don't trip the "direct children of AnimatePresence need
    // a key" check in _MotionContainer.
    if (presenceDepth !== undefined) {
        setPresenceDepth(presenceDepth + 1)
    }

    // Four-phase lifecycle:
    //   'idle'          — no exit in progress; render iff `present`.
    //   'holding'       — `present` flipped false; we're still rendering with
    //                     isPresent=false, waiting for the consumer to call
    //                     safeToRemove.
    //   'completed'     — consumer signaled completion. Stop rendering.
    //   'enter-blocked' — mode='wait' is holding this child out of the tree
    //                     until all sibling exits complete.
    type ExitPhase = 'idle' | 'holding' | 'completed' | 'enter-blocked'
    let phase = $state<ExitPhase>('idle')
    // Track the prior `present` value so we only start an exit on a true→false
    // transition, not when mounted with `present=false` (a no-op steady state).
    // Using a closure variable inside $effect.pre below — see initial value
    // capture there.
    let prevPresent: boolean | undefined = undefined

    // Each exit start mints a fresh `safeToRemove` closure bound to the cycle
    // it was minted for. Re-entry / completion invalidates older closures so a
    // captured-then-late-fired callback (setTimeout, external lib, stray
    // listener after cleanup) from cycle A cannot complete cycle B.
    const exitRegistry = createPresenceExitRegistry()
    let completeDescendant: NonNullable<PresenceContextProps['onExitComplete']> = () => {}
    let currentSafeToRemove: () => void = noopSafeToRemove
    let waitEnterVersion = 0
    let unsubscribeEnterUnblocked: (() => void) | null = null

    function noopSafeToRemove() {}

    let removePop: () => void = () => {}

    // Where the pop element rests, for applyPop's "before" point (see
    // `createPopLayoutPointCache`). Only followed in popLayout mode, while no
    // exit holds the element popped.
    const popPointCache = createPopLayoutPointCache()
    let popTrackScheduled = false
    let popTrackAttempts = 0
    // Set on destroy: a queued microtask or retry frame must not re-track.
    let destroyed = false
    // Set by a legacy reactive `usePresence()` call (`$derived(usePresence())`):
    // this wrapper keeps the pre-registration manual hold (plan 017). Sticky
    // for the wrapper's lifetime.
    let legacyManual = false
    const trackPopElement = () => {
        if (destroyed || animatePresence?.mode !== 'popLayout' || popTrackScheduled) return
        popTrackScheduled = true
        queueMicrotask(() => {
            popTrackScheduled = false
            if (destroyed) return
            if (phase !== 'idle' || !present) {
                popPointCache.track(undefined)
                return
            }
            const element = exitRegistry.getPopElement()
            popPointCache.track(element)
            // The motion element registers as its VisualElement mounts, which
            // can land after this flush: look again for a few frames.
            if (element) popTrackAttempts = 0
            else if (popTrackAttempts++ < 10) requestAnimationFrame(trackPopElement)
        })
    }
    // Start (or restart, after a re-entry) following the resting point once
    // the update is in the DOM.
    $effect(() => {
        void present
        void phase
        trackPopElement()
    })

    /**
     * `mode="popLayout"`: take the held content out of the layout flow while it
     * exits, so siblings reflow immediately. Port of framer-motion
     * `components/AnimatePresence/PopChild.tsx` @ v14.7.1 (#2503, #2348):
     * PresenceChild has no ref to its snippet content, so the element is the
     * outermost motion element registered with this wrapper.
     *
     * Must run before the DOM update that starts the exit, while the element is
     * still in flow (upstream measures in `getSnapshotBeforeUpdate`). Like
     * upstream, the pop is a `[data-motion-pop-id]` rule in an injected
     * stylesheet rather than inline styles, so the element's own `style` is
     * left untouched and cleanup is just deleting the rule. Popping the element
     * can move the container it is pinned to, so once the whole update is in
     * the DOM the element is measured again and the rule offset back by however
     * far it moved (`schedulePopLayoutCorrection`, on motion-dom's microtask
     * frameloop, which runs after Svelte's synchronous flush). MotionConfig has
     * no `nonce` in svelte-motion, so none is set on the `<style>`.
     */
    function applyPop(): void {
        removePop()
        const element = exitRegistry.getPopElement()
        if (!element) return
        const snapshot = measurePopLayoutSnapshot(element, getComputedStyle(element))
        if (!snapshot.width || !snapshot.height) return
        // Where it rested before this update's DOM changes, when known.
        snapshot.point = popPointCache.read(element) ?? snapshot.point
        // Popped positions aren't resting ones.
        popPointCache.track(undefined)

        const { anchorX, anchorY, root } = animatePresence?.getPopLayoutOptions() ?? {
            anchorX: 'left',
            anchorY: 'top'
        }
        const id = `svelte-motion-pop-${++popIdCounter}`
        // Reads the (mutable) snapshot, so a correction rebuilds it.
        const buildRule = () => {
            const declarations = Object.entries(
                // Only plain string declarations (position, width, height, edges).
                resolvePopLayoutStyles(snapshot, anchorX, anchorY) as Record<string, string>
            )
                .map(([property, value]) => `${property}: ${value} !important;`)
                .join(' ')
            return `[data-motion-pop-id="${id}"] { ${declarations} }`
        }

        // The element's own document, so this works in another window/iframe.
        const doc = element.ownerDocument
        const style = doc.createElement('style')
        const parent = root ?? doc.head
        const insertRule = () => {
            if (style.sheet) style.sheet.insertRule(buildRule())
            else style.textContent = buildRule()
        }

        // Upstream measures in `getSnapshotBeforeUpdate` and pops in
        // `useInsertionEffect` (PopChild.tsx @ v14.7.1, lines 87-111 and
        // 181-200), so the projection's own `getSnapshotBeforeUpdate` →
        // `willUpdate` still sees the in-flow box. Here the descendants' layout
        // snapshots run in their own `$effect.pre`s after this one, so the pop
        // waits for this component's post-update `$effect` (same flush, before
        // the microtask frameloop measures and corrects it).
        pendingPop = () => {
            element.dataset.motionPopId = id
            parent.appendChild(style)
            insertRule()
            // Scheduled from the insertion, like upstream's
            // `useInsertionEffect` (lines 215-236), so it measures the popped
            // element even if the pop lands in a later flush.
            schedulePopLayoutCorrection(
                element,
                snapshot,
                // Removed since: the element is present again, or gone.
                () => style.isConnected && element.dataset.motionPopId === id,
                () => {
                    if (style.sheet?.cssRules.length) style.sheet.deleteRule(0)
                    insertRule()
                }
            )
        }
        popVersion += 1

        removePop = () => {
            removePop = () => {}
            pendingPop = null
            // Back in flow (re-entry), or about to unmount (tracking skips it).
            trackPopElement()
            if (element.dataset.motionPopId === id) element.removeAttribute('data-motion-pop-id')
            style.remove()
        }
    }

    // The deferred half of `applyPop`, see there.
    let pendingPop: (() => void) | null = null
    let popVersion = $state(0)
    $effect(() => {
        void popVersion
        const pop = pendingPop
        pendingPop = null
        pop?.()
    })

    function cancelWaitEnterBlock(): void {
        waitEnterVersion += 1
        unsubscribeEnterUnblocked?.()
        unsubscribeEnterUnblocked = null
    }

    function releaseWaitEnterBlock(version: number): void {
        if (waitEnterVersion !== version || !present || phase !== 'enter-blocked') return
        unsubscribeEnterUnblocked?.()
        unsubscribeEnterUnblocked = null
        phase = 'idle'
    }

    function scheduleWaitEnterProbe(callback: () => void): void {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(callback)
            return
        }

        setTimeout(callback, 0)
    }

    function beginWaitEnterBlock(): void {
        cancelWaitEnterBlock()
        phase = 'enter-blocked'

        const version = waitEnterVersion
        scheduleWaitEnterProbe(() => {
            if (waitEnterVersion !== version || !present || phase !== 'enter-blocked') return

            if (animatePresence?.isEnterBlocked()) {
                unsubscribeEnterUnblocked = animatePresence.onEnterUnblocked(() => {
                    releaseWaitEnterBlock(version)
                })
                return
            }

            releaseWaitEnterBlock(version)
        })
    }

    function mintSafeToRemove(): () => void {
        // Closure compares against its own identity (`self`) to detect
        // whether it's still the active cycle's callback. After re-entry or
        // completion, `currentSafeToRemove` no longer points at `self`, so
        // this branch no-ops — a stale capture cannot complete a later exit.
        const self: () => void = () => {
            if (currentSafeToRemove !== self || phase !== 'holding') return
            exitRegistry.cancel()
            removePop()
            phase = 'completed'
            currentSafeToRemove = noopSafeToRemove
            animatePresence?.notifyExitComplete()
        }
        return self
    }

    const isPresent = $derived(present && phase === 'idle')

    setPresenceChildContext({
        get isPresent() {
            return isPresent
        },
        get safeToRemove() {
            return currentSafeToRemove
        },
        register: exitRegistry.register,
        get onExitComplete() {
            return completeDescendant
        },
        markLegacyManual() {
            if (legacyManual) return false
            legacyManual = true
            return true
        }
    })

    // $effect.pre runs before DOM updates so the phase transition lands in
    // the same render pass as the `present` prop flip — otherwise the {#if}
    // below re-evaluates with stale phase and unmounts/remounts the children,
    // which (a) breaks any CSS transition the consumer relies on for exit and
    // (b) makes `bind:this` references go stale.
    //
    // That ordering doesn't always hold: a flip made from a user effect in
    // the same flush (the page's `onMount`, during hydration) re-ran the
    // {#if} first. Upstream's `PresenceChild` keeps rendering its children
    // through the flip (PresenceChild.tsx:115-125 @ v14.7.1), so the
    // condition also renders them while an exit is about to start (the last
    // seen `present` was true and the phase is still idle). A child
    // re-created already not present never relegated its `layoutId` node,
    // which stayed the stack's present lead and was never released
    // (plan 012 A5).
    const rendersChildren = () =>
        present
            ? phase !== 'enter-blocked'
            : phase === 'holding' || (phase === 'idle' && prevPresent === true)

    $effect.pre(() => {
        // Read both reactive sources (`present` prop + `phase` $state)
        // unconditionally at the top so the effect's dependency set is
        // identical on every run. Under svelte 5.55.7, conditionally
        // reading `phase` inside the branches below caused the effect to
        // intermittently skip re-runs after `present` flipped through
        // false → true → false — so cycle B never fired its mint and a
        // stale consumer-captured `safeToRemove` from cycle A was the
        // only callback available (#345).
        const current = present
        const currentPhase = phase
        if (prevPresent === undefined) {
            prevPresent = current
            return
        }
        if (prevPresent && !current && currentPhase === 'enter-blocked') {
            cancelWaitEnterBlock()
            exitRegistry.cancel()
            phase = 'idle'
            currentSafeToRemove = noopSafeToRemove
        } else if (prevPresent && !current && currentPhase === 'idle') {
            cancelWaitEnterBlock()
            // Before the DOM update, so the element is measured in flow.
            if (animatePresence?.mode === 'popLayout') applyPop()
            phase = 'holding'
            currentSafeToRemove = mintSafeToRemove()
            completeDescendant = exitRegistry.begin(currentSafeToRemove)
            animatePresence?.notifyExitStart()
        } else if (!prevPresent && current && currentPhase === 'holding') {
            // Re-entry mid-hold cancels the exit accounting. Replacing the
            // slot invalidates the cycle's `safeToRemove` for any consumer
            // that captured it.
            cancelWaitEnterBlock()
            exitRegistry.cancel()
            removePop()
            phase = 'idle'
            currentSafeToRemove = noopSafeToRemove
            animatePresence?.notifyExitComplete()
        } else if (
            !prevPresent &&
            current &&
            (currentPhase === 'completed' || currentPhase === 'idle')
        ) {
            // Re-mounted after a previous exit fully completed, or entering
            // from a steady false state. In wait mode, hold the enter for one
            // frame so sibling PresenceChild exits that start later in the
            // same update can raise the shared exit block first.
            if (animatePresence?.mode === 'wait') {
                beginWaitEnterBlock()
            } else {
                phase = 'idle'
            }
        } else if (!current) {
            cancelWaitEnterBlock()
        } else if (currentPhase === 'enter-blocked' && animatePresence?.mode !== 'wait') {
            phase = 'idle'
        }
        prevPresent = current
    })

    onDestroy(() => {
        destroyed = true
        popPointCache.dispose()
        cancelWaitEnterBlock()
        exitRegistry.cancel()
        removePop()
        // Settle a pending exit when the wrapper itself unmounts mid-hold
        // (an outer conditional removed us before the consumer called
        // safeToRemove). Without this the parent AnimatePresence's
        // in-flight exit counter leaks: onExitComplete never fires and
        // mode='wait' blocks sibling enters forever. Analogue of
        // upstream's PresenceChild register-cleanup fix (motion#3707).
        if (phase === 'holding') {
            phase = 'completed'
            currentSafeToRemove = noopSafeToRemove
            animatePresence?.notifyExitComplete()
        }
    })
</script>

{#if rendersChildren()}
    {@render children?.()}
{/if}
