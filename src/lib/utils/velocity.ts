import { motionValue } from 'motion-dom'
import { readable, writable, type Readable } from 'svelte/store'

/**
 * Parses a numeric value from a number or unit string (e.g. "100px" → 100).
 */
const parseNumeric = (v: number | string): number => {
    if (typeof v === 'number') return v
    const parsed = Number.parseFloat(String(v))
    return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Creates a readable store that tracks the velocity of a source store's value.
 *
 * Uses `motionValue` from motion-dom for built-in velocity tracking with
 * timestamps. Polls velocity via `requestAnimationFrame` and settles to 0
 * when movement stops.
 *
 * SSR-safe: returns a static `readable(0)` on the server.
 *
 * @param source A readable store of numeric or unit-string values.
 * @returns A readable store of the current velocity in units/second.
 * @see https://motion.dev/docs/react-use-velocity
 */
export const useVelocity = (source: Readable<number | string>): Readable<number> => {
    if (typeof window === 'undefined') return readable(0, () => {})

    const mv = motionValue(0)
    const store = writable(0)

    let raf = 0
    let settled = true

    const poll = () => {
        const v = mv.getVelocity()
        store.set(v)
        if (Math.abs(v) < 0.001) {
            settled = true
            store.set(0)
            raf = 0
            return
        }
        raf = requestAnimationFrame(poll)
    }

    const startPolling = () => {
        if (!settled) return
        settled = false
        raf = requestAnimationFrame(poll)
    }

    return readable<number>(0, (set) => {
        const unsubStore = store.subscribe(set)
        const unsubSource = source.subscribe((v) => {
            mv.set(parseNumeric(v))
            startPolling()
        })
        return () => {
            unsubStore()
            unsubSource()
            if (raf) cancelAnimationFrame(raf)
        }
    })
}
