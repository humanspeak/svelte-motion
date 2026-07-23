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

/**
 * Gesture priority order, lowest first (upstream framer-motion
 * variant-props.ts: `animate < … < whileHover < whileTap < whileDrag`). Only
 * the two gestures this coordinator tracks appear here; `tap` outranks `hover`,
 * so a key `tap` owns is protected from the `hover` system.
 */
const GESTURE_PRIORITY: readonly GestureType[] = ['hover', 'tap']

export type GestureCoordinator = {
    /**
     * Record a gesture type becoming active/inactive (upstream `setActive`).
     *
     * @param type Gesture becoming active/inactive.
     * @param isActive Whether the gesture is now active.
     * @param ownedKeys Keys this gesture animates while active (upstream
     * `protectedKeys`). Recorded on activate so higher-priority gestures can
     * protect them; cleared on deactivate. Omitting keys owns nothing new,
     * preserving the flag-only callers.
     */
    setActive: (type: GestureType, isActive: boolean, ownedKeys?: string[]) => void
    /** Whether a gesture type is currently active. */
    isActive: (type: GestureType) => boolean
    /**
     * Keys a gesture currently owns (empty when inactive or key-less). Upstream
     * `protectedKeys` for one gesture type.
     */
    ownedKeys: (type: GestureType) => ReadonlySet<string>
    /**
     * Whether `key` is owned by a gesture with strictly higher priority than
     * `below` (upstream: a higher-priority variant protects the key). Directional
     * — `tap`'s keys are protected from `hover`, but `hover`'s keys are never
     * protected from `tap`.
     *
     * @param key Transform/style key to test.
     * @param below The asking gesture; only gestures above it can protect.
     * @returns `true` when a higher-priority active gesture owns `key`.
     */
    isKeyProtected: (key: string, below: GestureType) => boolean
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
    /**
     * Record that a value was written outside motion's element animations
     * (e.g. the hover system's composed transform writer). Motion's internal
     * motion value for that key is now stale.
     */
    markExternalWrite: (key: string) => void
    /**
     * Whether a key was externally written since the last consume; clears the
     * flag. A consumer starting a motion element animation on that key must
     * seed its keyframes from the element's visual value or the first frame
     * snaps to motion's stale internal value.
     */
    consumeExternalWrite: (key: string) => boolean
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
    const externalWrites = new Set<string>()
    // Keys each gesture currently owns (upstream protectedKeys). Recorded on
    // activate, cleared on deactivate.
    const owned = new Map<GestureType, Set<string>>()

    return {
        markExternalWrite: (key) => {
            externalWrites.add(key)
        },
        consumeExternalWrite: (key) => externalWrites.delete(key),
        setActive: (type, isActive, ownedKeys) => {
            if (isActive) {
                active.add(type)
                owned.set(type, new Set(ownedKeys ?? []))
            } else {
                active.delete(type)
                owned.delete(type)
            }
        },
        isActive: (type) => active.has(type),
        ownedKeys: (type) => owned.get(type) ?? new Set<string>(),
        isKeyProtected: (key, below) => {
            const belowRank = GESTURE_PRIORITY.indexOf(below)
            for (let rank = belowRank + 1; rank < GESTURE_PRIORITY.length; rank++) {
                const higher = GESTURE_PRIORITY[rank]
                if (active.has(higher) && owned.get(higher)?.has(key)) return true
            }
            return false
        },
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
