<script lang="ts" module>
    // Unique per popped element across every PresenceChild on the page.
    let popIdCounter = 0
</script>

<script lang="ts">
    import { onDestroy, type Snippet } from 'svelte'
    import { createPresenceExitRegistry } from '$lib/utils/presenceExitRegistry'
    import type { PresenceContextProps } from 'motion-dom'
    import {
        getAnimatePresenceContext,
        getPresenceDepth,
        measurePopLayoutSnapshot,
        resolvePopLayoutStyles,
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

    /**
     * `mode="popLayout"`: take the held content out of the layout flow while it
     * exits, so siblings reflow immediately. Port of framer-motion
     * `components/AnimatePresence/PopChild.tsx` @ v14.5.0 (#2503): PresenceChild
     * has no ref to its snippet content, so the element is the outermost motion
     * element registered with this wrapper.
     *
     * Must run before the DOM update that starts the exit, while the element is
     * still in flow (upstream measures in `getSnapshotBeforeUpdate`). Like
     * upstream, the pop is a `[data-motion-pop-id]` rule in an injected
     * stylesheet rather than inline styles, so the element's own `style` is
     * left untouched and cleanup is just deleting the rule. MotionConfig has no
     * `nonce` in svelte-motion, so none is set on the `<style>`.
     */
    function applyPop(): void {
        removePop()
        const element = exitRegistry.getPopElement()
        if (!element) return
        const snapshot = measurePopLayoutSnapshot(element, getComputedStyle(element))
        if (!snapshot.width || !snapshot.height) return

        const id = `svelte-motion-pop-${++popIdCounter}`
        const declarations = Object.entries(
            // Only plain string declarations (position, width, height, edges).
            resolvePopLayoutStyles(snapshot) as Record<string, string>
        )
            .map(([property, value]) => `${property}: ${value} !important;`)
            .join(' ')
        const rule = `[data-motion-pop-id="${id}"] { ${declarations} }`

        element.dataset.motionPopId = id
        // The element's own document, so this works in another window/iframe.
        const doc = element.ownerDocument
        const style = doc.createElement('style')
        doc.head.appendChild(style)
        if (style.sheet) style.sheet.insertRule(rule)
        else style.textContent = rule

        removePop = () => {
            removePop = () => {}
            if (element.dataset.motionPopId === id) element.removeAttribute('data-motion-pop-id')
            style.remove()
        }
    }

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

{#if (present && phase !== 'enter-blocked') || phase === 'holding'}
    {@render children?.()}
{/if}
