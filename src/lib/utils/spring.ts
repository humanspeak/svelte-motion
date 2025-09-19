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
    if (!match) return { value: 0, unit: '' }
    return { value: parseFloat(match[1]!), unit: match[2] ?? '' }
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
    set: (v: number | string) => void
    jump: (v: number | string) => void
} => {
    if (typeof window === 'undefined') {
        const initial =
            typeof source === 'object' ? (('subscribe' in source ? 0 : 0) as number) : source
        const store = readable(initial as number | string, () => {}) as Readable<
            number | string
        > & { set: (v: number | string) => void; jump: (v: number | string) => void }
        // No-op setters on server
        ;(store as unknown as { set: (v: number | string) => void }).set = () => {}
        ;(store as unknown as { jump: (v: number | string) => void }).jump = () => {}
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
        const dt = Math.max(0.001, (t - lastTime) / 1000)
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
        const unsub = (source as Readable<number | string>).subscribe((v) => api.set(v))
        const wrapped = readable<number | string>(formatUnit(state.current.value, unit), (set) => {
            const sub = store.subscribe(set)
            return () => {
                sub()
                unsub()
                if (raf) cancelAnimationFrame(raf)
            }
        }) as Readable<number | string> & {
            set: (v: number | string) => void
            jump: (v: number | string) => void
        }
        ;(wrapped as unknown as { set: (v: number | string) => void }).set = api.set
        ;(wrapped as unknown as { jump: (v: number | string) => void }).jump = api.jump
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
        set: (v: number | string) => void
        jump: (v: number | string) => void
    }
    ;(wrapped as unknown as { set: (v: number | string) => void }).set = api.set
    ;(wrapped as unknown as { jump: (v: number | string) => void }).jump = api.jump
    return wrapped
}
