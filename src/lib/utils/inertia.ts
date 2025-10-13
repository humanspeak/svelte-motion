/**
 * Inertia → spring handoff utilities (axis-only, pure, testable).
 *
 * Implements exponential velocity decay until crossing a bound, then hands off
 * to a damped spring targeting the nearest boundary. If out-of-bounds at t=0,
 * spring starts immediately.
 *
 * This module is SSR-safe and holds no references to the DOM or timers.
 */

export type AxisState = { value: number; velocity: number }
export type Bounds = { min: number; max: number }
export type InertiaHandoffOptions = {
    timeConstantMs: number
    restDelta: number
    restSpeed: number
    bounceStiffness: number
    bounceDamping: number
}

export type StepResult = { value: number; done: boolean }

type Mode = 'inertia' | 'spring' | 'done'

/**
 * Compute the asymptotic displacement reachable by inertia with exponential
 * velocity decay: x(t) = x0 + v0 * tau * (1 - e^{-t/tau}).
 * The maximum reachable delta as t→∞ is v0 * tau.
 */
const maxInertiaReach = (v0: number, tau: number): number => v0 * tau

/**
 * Closed form inertia position and velocity at elapsed time.
 * - Position: x(t) = x0 + v0 * tau * (1 - e^{-t/tau})
 * - Velocity: v(t) = v0 * e^{-t/tau}
 */
const inertiaAt = (
    x0: number,
    v0: number,
    tauMs: number,
    tMs: number
): { x: number; v: number } => {
    const tauMsSafe = Math.max(1, tauMs)
    const k = Math.exp(-tMs / tauMsSafe)
    const tauSeconds = tauMsSafe / 1000
    const x = x0 + v0 * tauSeconds * (1 - k)
    const v = v0 * k
    return { x, v }
}

/**
 * Solve for first crossing time to a boundary if reachable.
 * For boundary B in direction of v0, solve B = x0 + v0 * tau * (1 - e^{-t/tau}).
 * t = -tau * ln(1 - (B - x0) / (v0 * tau))
 */
const solveCrossTimeMs = (
    x0: number,
    v0: number,
    tauMs: number,
    boundary: number
): number | undefined => {
    if (v0 === 0) return undefined
    const tau = Math.max(1, tauMs)
    const reach = maxInertiaReach(v0, tau / 1000) // v0 (px/s) * tau(s) = px
    const delta = boundary - x0
    // Must be in forward direction and within asymptotic reach
    if (Math.sign(delta) !== Math.sign(v0) || Math.abs(delta) > Math.abs(reach)) return undefined
    const r = 1 - delta / reach
    if (r <= 0) return undefined // would imply infinite time
    const t = -tau * Math.log(r)
    if (!Number.isFinite(t) || t < 0) return undefined
    return t
}

/**
 * Create a stepper that yields a value at each elapsed time. Handoff from
 * inertia to spring when crossing the bounds.
 */
export function createInertiaToBoundary(
    initial: AxisState,
    bounds: Bounds,
    opts: InertiaHandoffOptions
): (tMs: number) => StepResult {
    const min = bounds.min
    const max = bounds.max
    const tauMs = Math.max(1, opts.timeConstantMs)

    // Internal spring state
    let mode: Mode = 'inertia'
    let lastT = 0
    let x = initial.value
    let v = initial.velocity // px/s

    // Spring state values (activated post-handoff)
    let springX = x
    let springV = 0
    let boundaryTarget: number | null = null

    // If starting OOB, skip inertia
    if (x < min || x > max) {
        mode = 'spring'
        // Set spring start at current value and carry current velocity
        springX = x
        springV = v
        boundaryTarget = x < min ? min : max
    }

    // Precompute first crossing (if any) from initial state
    const nearestBoundary = v < 0 ? min : max
    const tCross =
        mode === 'inertia'
            ? solveCrossTimeMs(initial.value, initial.velocity, tauMs, nearestBoundary)
            : undefined

    const stepSpring = (dt: number) => {
        // dt in seconds (will be called with small fixed steps for stability)
        const stiffness = opts.bounceStiffness
        const damping = opts.bounceDamping
        // Hooke's law with simple semi-implicit Euler integration relative to the boundary
        const target = boundaryTarget ?? (springX < min ? min : max)
        const displacement = springX - target
        const force = -stiffness * displacement - damping * springV
        const accel = force // mass = 1
        springV += accel * dt
        springX += springV * dt
    }

    return (tMs: number): StepResult => {
        // Ensure monotonic time
        if (tMs < lastT) tMs = lastT
        const dtMs = tMs - lastT
        const dt = Math.min(0.1, Math.max(0.001, dtMs / 1000))

        if (mode === 'inertia') {
            if (tCross !== undefined && tMs >= tCross) {
                // Hand off to spring exactly at crossing
                const at = inertiaAt(initial.value, initial.velocity, tauMs, tCross)
                boundaryTarget = nearestBoundary
                springX = at.x
                springV = at.v // carry velocity continuity
                mode = 'spring'
                // Advance spring only for the remaining time after the handoff
                const remainingMs = tMs - tCross
                // Perform small fixed substeps for numerical stability
                let remaining = Math.max(0, remainingMs) / 1000
                while (remaining > 0) {
                    const h = Math.min(0.016, remaining)
                    stepSpring(h)
                    remaining -= h
                }
                lastT = tMs
                const tgt = boundaryTarget ?? (springX < min ? min : max)
                const done =
                    Math.abs(springV) <= opts.restSpeed && Math.abs(springX - tgt) <= opts.restDelta
                const value = done ? tgt : springX
                if (done) mode = 'done'
                return { value, done }
            } else {
                const at = inertiaAt(initial.value, initial.velocity, tauMs, tMs)
                x = at.x
                v = at.v
                lastT = tMs
                const done = Math.abs(v) <= opts.restSpeed
                // If never crossing and slowed sufficiently, finish inertia
                if (done && x >= min && x <= max) {
                    mode = 'done'
                    return { value: x, done: true }
                }
                return { value: x, done: false }
            }
        }

        if (mode === 'spring') {
            // Advance with fixed small substeps for numerical stability
            let remaining = dt
            while (remaining > 0) {
                const h = Math.min(0.016, remaining)
                stepSpring(h)
                remaining -= h
            }
            lastT = tMs
            const tgt = boundaryTarget ?? (springX < min ? min : max)
            const done =
                Math.abs(springV) <= opts.restSpeed && Math.abs(springX - tgt) <= opts.restDelta
            const value = done ? tgt : springX
            if (done) mode = 'done'
            return { value, done }
        }

        // done: return the last settled position from the correct regime
        // If we ever engaged a spring (boundaryTarget set), use springX; otherwise use inertial x
        const settled = boundaryTarget != null ? springX : x
        return { value: Math.min(max, Math.max(min, settled)), done: true }
    }
}
