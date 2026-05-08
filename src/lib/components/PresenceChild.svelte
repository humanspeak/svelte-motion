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

    const isPresent = $derived(present && phase === 'idle')

    setPresenceChildContext({
        get isPresent() {
            return isPresent
        },
        safeToRemove
    })

    function safeToRemove() {
        // Idempotent + versioned. A stale callback from a canceled exit
        // (re-entry before this fires) sees phase != 'holding' and no-ops.
        if (phase !== 'holding') return
        phase = 'completed'
        animatePresence?.notifyExitComplete()
    }

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
            animatePresence?.notifyExitStart()
        } else if (!prevPresent && current && phase === 'holding') {
            // Re-entry mid-hold cancels the exit accounting.
            phase = 'idle'
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
