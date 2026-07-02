<script lang="ts">
    import { onDestroy, type Snippet } from 'svelte'
    import {
        getAnimatePresenceContext,
        getPresenceDepth,
        setPresenceChildContext,
        setPresenceDepth
    } from '$lib/utils/presence'

    /**
     * Holds its `children` snippet rendered until the consumer signals the
     * exit is complete via `safeToRemove()`. Lets a child run its own (non-
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
    const { present = true, children } = $props<{
        present?: boolean
        children?: Snippet
    }>()

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
    let currentSafeToRemove: () => void = noopSafeToRemove
    let waitEnterVersion = 0
    let unsubscribeEnterUnblocked: (() => void) | null = null

    function noopSafeToRemove() {}

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
        }
    })

    // $effect.pre runs before DOM updates so the phase transition lands in
    // the same render pass as the `present` prop flip — otherwise the {#if}
    // below re-evaluates with stale phase and unmounts/remounts the children,
    // which (a) breaks any CSS transition the consumer relies on for exit and
    // (b) makes `bind:this` references go stale.
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
            phase = 'idle'
            currentSafeToRemove = noopSafeToRemove
        } else if (prevPresent && !current && currentPhase === 'idle') {
            cancelWaitEnterBlock()
            phase = 'holding'
            currentSafeToRemove = mintSafeToRemove()
            animatePresence?.notifyExitStart()
        } else if (!prevPresent && current && currentPhase === 'holding') {
            // Re-entry mid-hold cancels the exit accounting. Replacing the
            // slot invalidates the cycle's `safeToRemove` for any consumer
            // that captured it.
            cancelWaitEnterBlock()
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
        cancelWaitEnterBlock()
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

{#if (present && phase !== 'enter-blocked') || phase === 'holding'}
    {@render children?.()}
{/if}
