/**
 * Shared per-element coordination between gesture animation systems
 * (whileHover / whileTap).
 *
 * Mirrors upstream framer-motion's contract, where gestures never animate
 * directly — they flip `animationState.setActive('whileHover'|'whileTap', …)`
 * (framer-motion/src/gestures/hover.ts, press.ts) and a single resolver owns
 * every value with higher-priority types protecting their keys
 * (motion-dom/src/render/utils/animation-state.ts, priority order in
 * variant-props.ts: animate < … < whileHover < whileTap < whileDrag).
 *
 * Our port lets each gesture run its own animations, so this coordinator
 * supplies the two upstream guarantees the split systems were missing:
 *
 * 1. **Single writer** — every gesture animation registers its stopper here,
 *    and starting a new gesture animation stops all in-flight ones, so a
 *    hover-exit unwind can never fight a tap-release spring for the same
 *    transform (the fight ends in a visible snap when one writer finishes).
 * 2. **Priority flags** — `hover`/`tap` active state is tracked as state, not
 *    inferred from the DOM, so the tap system can ask "is hover still
 *    active?" reliably and the hover system can yield its keys while a
 *    higher-priority tap is in progress.
 */

/** Gesture types the coordinator tracks, lowest priority first. */
export type GestureType = 'hover' | 'tap'

export type GestureCoordinator = {
    /** Record a gesture type becoming active/inactive (upstream `setActive`). */
    setActive: (type: GestureType, isActive: boolean) => void
    /** Whether a gesture type is currently active. */
    isActive: (type: GestureType) => boolean
    /**
     * Register an in-flight gesture animation's stopper. Returns an
     * unregister function for animations that complete naturally.
     */
    register: (stop: () => void) => () => void
    /**
     * Stop every registered in-flight gesture animation. Call before starting
     * a new gesture animation so exactly one writer owns the element.
     */
    stopAll: () => void
}

/**
 * Create a gesture coordinator for one element.
 *
 * @returns A coordinator shared by that element's gesture attachments.
 * @example
 * ```ts
 * const coordinator = createGestureCoordinator()
 * attachWhileHover(el, hoverDef, transition, cbs, sources, composer, coordinator)
 * attachWhileTap(el, tapDef, initial, animate, { ...cbs, coordinator })
 * ```
 */
export const createGestureCoordinator = (): GestureCoordinator => {
    const active = new Set<GestureType>()
    const stoppers = new Set<() => void>()

    return {
        setActive: (type, isActive) => {
            if (isActive) active.add(type)
            else active.delete(type)
        },
        isActive: (type) => active.has(type),
        register: (stop) => {
            stoppers.add(stop)
            return () => stoppers.delete(stop)
        },
        stopAll: () => {
            for (const stop of stoppers) {
                try {
                    stop()
                } catch {
                    // A finished animation's stop() may throw; the goal is
                    // only that nothing keeps writing.
                }
            }
            stoppers.clear()
        }
    }
}
