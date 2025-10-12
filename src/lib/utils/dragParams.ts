/**
 * Boundary physics options used during inertia→spring handoff.
 *
 * - `timeConstantMs` controls exponential decay during the inertia phase.
 * - `restDelta` and `restSpeed` define settle thresholds for both phases.
 * - `bounceStiffness` and `bounceDamping` configure the spring at the boundary.
 */
export type BoundaryPhysics = {
    timeConstantMs: number
    restDelta: number
    restSpeed: number
    bounceStiffness: number
    bounceDamping: number
}

/**
 * Derives boundary spring/inertia parameters from drag context.
 *
 * Behavior
 * - If `elastic` is truthy (> 0), use Framer-like defaults: `bounceStiffness=200`, `bounceDamping=40`.
 * - If falsy (`0`/`false`/`undefined`), use extremely large values to overdamp (no visible bounce).
 * - Applies overrides from `transition` (if provided) and maps `timeConstant` (seconds) → `timeConstantMs` (milliseconds).
 *
 * @param {number|undefined} elastic Elasticity value from drag context (`dragElastic`).
 *   Values > 0 indicate elastic overdrag; `0`/`false` disables it.
 * @param {{ bounceStiffness?: number; bounceDamping?: number; timeConstant?: number; restDelta?: number; restSpeed?: number }=} transition
 *   Optional transition overrides (typically from `dragTransition`).
 *   - `timeConstant` is expressed in seconds and internally converted to milliseconds.
 * @returns {BoundaryPhysics} Fully resolved physics parameters for inertia and boundary spring.
 */
export function deriveBoundaryPhysics(
    elastic: number | undefined,
    transition?: {
        bounceStiffness?: number
        bounceDamping?: number
        timeConstant?: number
        restDelta?: number
        restSpeed?: number
    }
): BoundaryPhysics {
    const truthyElastic = typeof elastic === 'number' ? elastic > 0 : !!elastic
    let bounceStiffness = truthyElastic ? 200 : 1_000_000
    let bounceDamping = truthyElastic ? 40 : 10_000_000

    if (transition?.bounceStiffness != null) bounceStiffness = transition.bounceStiffness
    if (transition?.bounceDamping != null) bounceDamping = transition.bounceDamping

    const timeConstantSec = transition?.timeConstant ?? 0.75
    const timeConstantMs = Math.max(1, timeConstantSec * 1000)
    const restDelta = transition?.restDelta ?? 1
    const restSpeed = transition?.restSpeed ?? 10

    return { timeConstantMs, restDelta, restSpeed, bounceStiffness, bounceDamping }
}
