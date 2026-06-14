/**
 * Boundary physics options used during Framer-compatible drag inertia handoff.
 *
 * - `timeConstant` controls exponential decay during the inertia phase, in milliseconds.
 * - `power` scales the inertia target from release velocity.
 * - `restDelta` and `restSpeed` define settle thresholds.
 * - `bounceStiffness` and `bounceDamping` configure the spring at the boundary.
 */
export type BoundaryPhysics = {
    power: number
    timeConstant: number
    restDelta: number
    restSpeed?: number
    bounceStiffness: number
    bounceDamping: number
}

/**
 * Derives boundary spring/inertia parameters from drag context.
 *
 * Behavior
 * - Uses Framer Motion drag defaults: `power=0.8`, `timeConstant=750`,
 *   `restDelta=1`, `restSpeed=10`.
 * - Derives boundary spring damping from `dragElastic`, then applies
 *   `dragTransition` overrides without unit conversion.
 *
 * @param {number|undefined} elastic Elasticity value from drag context (`dragElastic`).
 *   Values > 0 use Framer's elastic boundary spring; `0`/`false` overdamps it.
 * @param {{ bounceStiffness?: number; bounceDamping?: number; power?: number; timeConstant?: number; restDelta?: number; restSpeed?: number }=} transition
 *   Optional transition overrides (typically from `dragTransition`).
 * @returns {BoundaryPhysics} Fully resolved physics parameters for inertia and boundary spring.
 */
export const deriveBoundaryPhysics = (
    elastic: number | undefined,
    transition?: {
        bounceStiffness?: number
        bounceDamping?: number
        power?: number
        timeConstant?: number
        restDelta?: number
        restSpeed?: number
    }
): BoundaryPhysics => {
    const truthyElastic = typeof elastic === 'number' ? elastic > 0 : !!elastic

    return {
        power: transition?.power ?? 0.8,
        timeConstant: transition?.timeConstant ?? 750,
        bounceStiffness: transition?.bounceStiffness ?? (truthyElastic ? 200 : 1_000_000),
        bounceDamping: transition?.bounceDamping ?? (truthyElastic ? 40 : 10_000_000),
        restDelta: transition?.restDelta ?? 1,
        restSpeed: transition?.restSpeed ?? 10
    }
}
