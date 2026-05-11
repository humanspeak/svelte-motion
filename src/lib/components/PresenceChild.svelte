<script lang="ts">
    import type { Snippet } from 'svelte'
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

    // Three-phase exit lifecycle:
    //   'idle'      — no exit in progress; render iff `present`.
    //   'holding'   — `present` flipped false; we're still rendering with
    //                 isPresent=false, waiting for the consumer to call
    //                 safeToRemove.
    //   'completed' — consumer signaled completion. Stop rendering. Returning
    //                 to 'idle' only happens if `present` flips back to true.
    type ExitPhase = 'idle' | 'holding' | 'completed'
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

    function noopSafeToRemove() {}

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
        // Read `present` reactively first; assignments to module locals
        // happen inside the branches below.
        const current = present
        // First run: just record the steady state. Don't fire any exit/enter
        // signal — there's no transition to react to yet.
        if (prevPresent === undefined) {
            prevPresent = current
            return
        }
        if (prevPresent && !current && phase === 'idle') {
            phase = 'holding'
            currentSafeToRemove = mintSafeToRemove()
            animatePresence?.notifyExitStart()
        } else if (!prevPresent && current && phase === 'holding') {
            // Re-entry mid-hold cancels the exit accounting. Replacing the
            // slot invalidates the cycle's `safeToRemove` for any consumer
            // that captured it.
            phase = 'idle'
            currentSafeToRemove = noopSafeToRemove
            animatePresence?.notifyExitComplete()
        } else if (!prevPresent && current && phase === 'completed') {
            // Re-mounted after a previous exit fully completed.
            phase = 'idle'
        }
        prevPresent = current
    })
</script>

{#if present || phase === 'holding'}
    {@render children?.()}
{/if}
