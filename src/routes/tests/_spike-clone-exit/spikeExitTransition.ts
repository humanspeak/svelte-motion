/**
 * THROWAWAY SPIKE CODE — clone-exit-migration plan 001, Candidate A
 * ("Svelte `out:` transition bridge").
 *
 * A Svelte transition function whose outro stands in for what
 * `_MotionContainer` would do on a real node: start the element's exit
 * animation (here a plain `animate()` call from `motion`; in the real
 * implementation this is `setActive('exit', true)` on the VisualElement) and
 * hold the node in the DOM until it finishes, so Svelte removes the REAL node
 * instead of `presence.ts` cloning it.
 *
 * Three completion strategies are implemented so the spike can measure
 * question (c) of Step 1 — "can `onExitComplete` end the outro exactly?":
 *
 * - `fixed`         — hardcoded duration, ignores the animation (naive baseline).
 * - `duration-match`— read the motion animation's own duration at outro time
 *                     and hand it to Svelte as the transition duration
 *                     (documented API only).
 * - `finish-hack`   — declare a 10s duration, then reach into
 *                     `element.getAnimations()` to `finish()` the WAAPI
 *                     animation Svelte created for the outro at the exact
 *                     instant the exit completes (relies on Svelte runtime
 *                     internals: `transitions.js:465` creates the animation via
 *                     `element.animate(keyframes, { duration, fill })`).
 */
import { animate } from 'motion'
import { spikeLog } from './spike-log'

export type SpikeExitStrategy = 'fixed' | 'duration-match' | 'finish-hack'

export type SpikeExitParams = {
    /** Identifies the node in the event log. */
    id: string
    /** Completion strategy under test. */
    strategy?: SpikeExitStrategy
    /** Exit keyframes for the real node. */
    keyframes?: Record<string, unknown>
    /** Exit duration in seconds for the motion animation. */
    duration?: number
    /** popLayout emulation: take the node out of layout flow before exiting. */
    popLayout?: boolean
}

const HACK_DURATION_MS = 10_000

const findSvelteOutroAnimation = (element: Element): Animation | undefined =>
    element.getAnimations().find((animation) => {
        const timing = animation.effect?.getComputedTiming()
        return (
            typeof timing?.duration === 'number' && Math.round(timing.duration) === HACK_DURATION_MS
        )
    })

/**
 * Svelte transition function. Use as `out:spikeExit={{ id, strategy }}` (add
 * `|global` to test global outro semantics).
 *
 * @param element The node being removed.
 * @param params Spike parameters (see `SpikeExitParams`).
 * @returns A Svelte `AnimationConfig` whose duration holds the node in the DOM.
 */
export function spikeExit(element: HTMLElement, params: SpikeExitParams) {
    const {
        id,
        strategy = 'duration-match',
        keyframes = { opacity: 0, scale: 0.5 },
        duration = 0.4,
        popLayout = false
    } = params

    spikeLog('transition-fn-called', { id, strategy, connected: element.isConnected })

    if (popLayout) {
        // Real-node popLayout: measure, then leave layout flow in place. No
        // clone, no placeholder — the node itself is absolutely positioned
        // against its offsetParent (this is what `PopChild` does upstream).
        const rect = element.getBoundingClientRect()
        const parent = element.offsetParent as HTMLElement | null
        const parentRect = parent?.getBoundingClientRect()
        element.style.position = 'absolute'
        element.style.width = `${rect.width}px`
        element.style.height = `${rect.height}px`
        element.style.top = `${rect.top - (parentRect?.top ?? 0)}px`
        element.style.left = `${rect.left - (parentRect?.left ?? 0)}px`
        spikeLog('poplayout-applied', { id, width: rect.width, height: rect.height })
    }

    // Stand-in for `visualElement.animationState.setActive('exit', true)`.
    const controls = animate(element, keyframes as never, { duration })
    spikeLog('exit-animation-start', { id, motionDuration: controls.duration })

    let svelteOutro: Animation | undefined

    if (strategy === 'finish-hack') {
        // `outrostart` is dispatched from `on_begin()` immediately BEFORE Svelte
        // creates the real WAAPI animation (transitions.js:415/465), so capture
        // on the next microtask.
        element.addEventListener(
            'outrostart',
            () => {
                queueMicrotask(() => {
                    svelteOutro = findSvelteOutroAnimation(element)
                    spikeLog('svelte-outro-captured', { id, found: !!svelteOutro })
                })
            },
            { once: true }
        )
    }

    controls.finished
        .then(() => {
            spikeLog('exit-animation-complete', { id, connected: element.isConnected })
            if (strategy === 'finish-hack') {
                if (svelteOutro) {
                    svelteOutro.finish()
                    spikeLog('svelte-outro-finished', { id })
                } else {
                    spikeLog('svelte-outro-missing', { id })
                }
            }
        })
        .catch(() => {})

    const transitionDuration =
        strategy === 'fixed'
            ? 1000
            : strategy === 'finish-hack'
              ? HACK_DURATION_MS
              : (controls.duration ?? duration) * 1000

    spikeLog('transition-config', { id, transitionDuration })

    return {
        duration: transitionDuration
        // Deliberately no `css`/`tick`: Svelte's animation is a pure timer
        // (`element.animate([], { duration })`), so it cannot fight motion's
        // writes to the same element.
    }
}
