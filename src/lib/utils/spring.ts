import { readable, writable, type Readable, type Writable } from 'svelte/store'

/**
 * Spring configuration options.
 *
 * This is a minimal subset modeled after Motion's spring transition options.
 * Values are tuned for sensible defaults, not parity.
 *
 * @typedef {Object} SpringOptions
 * @property {number=} stiffness Spring stiffness (higher = snappier). Default 170.
 * @property {number=} damping Spring damping (higher = less oscillation). Default 26.
 * @property {number=} mass Mass of the object. Default 1.
 * @property {number=} restDelta Threshold for absolute position delta to stop. Default 0.01.
 * @property {number=} restSpeed Threshold for velocity magnitude to stop. Default 0.01.
 */
export type SpringOptions = {
    stiffness?: number
    damping?: number
    mass?: number
    restDelta?: number
    restSpeed?: number
}

/**
 * Function type for updating the spring's target with animation.
 *
 * @param v New target value to animate towards (number or unit string).
 */
type SetType = (v: number | string) => void
/**
 * Function type for immediately setting the spring's value without animation.
 *
 * @param v New value to set instantly (number or unit string).
 */
type JumpType = (v: number | string) => void

/**
 * Parsed numeric value with optional unit suffix (e.g., `px`, `vh`).
 */
type UnitValue = { value: number; unit: string }

/**
 * Parses a number or unit string into numeric value and unit.
 * @param {number|string} v The input value.
 * @returns {UnitValue} Parsed value and unit.
 * @private
 */
const parseUnit = (v: number | string): UnitValue => {
    if (typeof v === 'number') return { value: v, unit: '' }
    const match = String(v).match(/^(-?\d*\.?\d+)(.*)$/)
    if (!match || !match[1]) return { value: 0, unit: '' }
    const parsed = Number.parseFloat(match[1])
    if (!Number.isFinite(parsed)) return { value: 0, unit: '' }
    const unit = match[2] ?? ''
    return { value: parsed, unit }
}

/**
 * Formats a numeric value with a unit.
 * @param {number} n Numeric value.
 * @param {string} unit Unit suffix.
 * @returns {number|string} Number or string with unit.
 * @private
 */
const formatUnit = (n: number, unit: string): number | string => (unit ? `${n}${unit}` : n)

/**
 * Creates a spring-animated readable store. The store exposes `set` to
 * animate towards a target, or `jump` to immediately set the value without
 * animation. When constructed with another readable store, the spring
 * automatically follows it.
 *
 * This is SSR-safe: On the server it returns a static store and no timers run.
 *
 * @template T
 * @param {number|string|Readable<number|string>} source Initial value or a source store to follow.
 * @param {SpringOptions=} options Spring configuration.
 * @returns {Readable<number|string> & { set: (v: number|string) => void; jump: (v: number|string) => void; }}
 */
export const useSpring = (
    source: number | string | Readable<number | string>,
    options: SpringOptions = {}
): Readable<number | string> & {
    set: SetType
    jump: JumpType
} => {
    if (typeof window === 'undefined') {
        // Derive best-effort initial value for SSR to avoid hydration mismatch
        let initial: number | string = 0
        if (typeof source === 'number' || typeof source === 'string') {
            initial = source
        } else if (source && typeof source === 'object') {
            const anySource = source as unknown as {
                get?: () => number | string
                value?: number | string
            }
            if (typeof anySource.get === 'function') {
                const v = anySource.get()
                if (typeof v === 'number' || typeof v === 'string') initial = v
            } else if (typeof anySource.value === 'number' || typeof anySource.value === 'string') {
                initial = anySource.value
            }
        }
        const store = readable(initial as number | string, () => {}) as Readable<
            number | string
        > & { set: SetType; jump: JumpType }
        // No-op setters on server
        ;(store as unknown as { set: SetType }).set = () => {}
        ;(store as unknown as { jump: JumpType }).jump = () => {}
        return store
    }

    const { stiffness = 170, damping = 26, mass = 1, restDelta = 0.01, restSpeed = 0.01 } = options

    const state: { current: UnitValue; target: UnitValue } = {
        current: parseUnit(typeof source === 'object' ? 0 : (source as number | string)),
        target: parseUnit(typeof source === 'object' ? 0 : (source as number | string))
    }

    const unit = state.current.unit || state.target.unit
    const store: Writable<number | string> = writable(
        formatUnit(state.current.value, unit) as number | string
    )

    let raf = 0
    let lastTime = 0
    let velocity = 0

    const step = (t: number) => {
        if (!lastTime) lastTime = t
        // Clamp dt to a safe range to avoid instability across large time gaps
        const dt = Math.min(0.1, Math.max(0.001, (t - lastTime) / 1000))
        lastTime = t

        const displacement = state.current.value - state.target.value
        // Spring force based on Hooke's Law: F = -k x; damping force: -c v
        const spring = -stiffness * displacement
        const damper = -damping * velocity
        const accel = (spring + damper) / mass
        velocity += accel * dt
        state.current.value += velocity * dt

        const isNoVelocity = Math.abs(velocity) <= restSpeed
        const isNoDisplacement = Math.abs(state.current.value - state.target.value) <= restDelta
        const done = isNoVelocity && isNoDisplacement

        if (done) {
            state.current.value = state.target.value
            store.set(formatUnit(state.current.value, unit))
            raf = 0
            lastTime = 0
            return
        }

        store.set(formatUnit(state.current.value, unit))
        raf = requestAnimationFrame(step)
    }

    const start = () => {
        if (raf) return
        raf = requestAnimationFrame(step)
    }

    const api = {
        set: (v: number | string) => {
            state.target = parseUnit(v)
            start()
        },
        jump: (v: number | string) => {
            state.current = parseUnit(v)
            state.target = parseUnit(v)
            velocity = 0
            store.set(formatUnit(state.current.value, state.current.unit || state.target.unit))
        }
    }

    // If following another store, subscribe and forward values to set()
    if (typeof source === 'object' && 'subscribe' in source) {
        let followSource = true
        const unsub = (source as Readable<number | string>).subscribe((v) => api.set(v))
        const wrapped = readable<number | string>(formatUnit(state.current.value, unit), (set) => {
            const sub = store.subscribe(set)
            return () => {
                sub()
                unsub()
                followSource = false
                if (raf) cancelAnimationFrame(raf)
            }
        }) as Readable<number | string> & {
            set: SetType
            jump: JumpType
        }
        ;(wrapped as unknown as { set: SetType }).set = (v: number | string) => {
            if (followSource) unsub()
            followSource = false
            api.set(v)
        }
        ;(wrapped as unknown as { jump: JumpType }).jump = (v: number | string) => {
            if (followSource) unsub()
            followSource = false
            api.jump(v)
        }
        return wrapped
    }

    // Standard readable wrapping internal writable
    const wrapped = readable<number | string>(formatUnit(state.current.value, unit), (set) => {
        const sub = store.subscribe(set)
        return () => {
            sub()
            if (raf) cancelAnimationFrame(raf)
        }
    }) as Readable<number | string> & {
        set: SetType
        jump: JumpType
    }
    ;(wrapped as unknown as { set: SetType }).set = api.set
    ;(wrapped as unknown as { jump: JumpType }).jump = api.jump
    return wrapped
}
