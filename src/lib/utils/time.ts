import { readable, type Readable } from 'svelte/store'

const SSR_ZERO: Readable<number> = readable(0, () => {})
const sharedStores = new Map<string, Readable<number>>()

// Clear shared timelines on HMR dispose to avoid stale entries across hot reloads
if (
    import.meta &&
    (import.meta as unknown as { hot?: { dispose: (cb: () => void) => void } }).hot
) {
    ;(import.meta as unknown as { hot: { dispose: (cb: () => void) => void } }).hot.dispose(() => {
        sharedStores.clear()
    })
}

/**
 * Creates a new time store that updates once per animation frame.
 *
 * The store value represents elapsed milliseconds since the store was created.
 * In SSR environments (no `window`), a static 0-valued store is returned.
 *
 * @returns {Readable<number>} A readable store of elapsed milliseconds.
 * @see https://motion.dev/docs/react-use-time?platform=react
 * @private
 */
const createTimeStore = (): Readable<number> => {
    if (typeof window === 'undefined') return SSR_ZERO
    return readable(0, (set) => {
        const start = performance.now()
        let raf = 0
        /* c8 ignore start */
        const loop = (t: number) => {
            set(t - start)
            raf = requestAnimationFrame(loop)
        }
        /* c8 ignore stop */
        raf = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(raf)
    })
}

/**
 * Returns a time store that ticks once per animation frame.
 *
 * - Without an `id`, returns a fresh timeline per call.
 * - With an `id`, callers sharing the same id receive the same store/timeline,
 *   ensuring synchronized reads across components.
 * - SSR-safe: Returns a static 0-valued store when `window` is unavailable.
 *
 * @param {string=} id Optional timeline identifier for sharing across calls.
 * @returns {Readable<number>} A readable store of elapsed milliseconds.
 * @see https://motion.dev/docs/react-use-time?platform=react
 */
export const useTime = (id?: string): Readable<number> => {
    if (!id) return createTimeStore()
    if (typeof window === 'undefined') return SSR_ZERO
    const existing = sharedStores.get(id)
    if (existing) return existing
    const base = createTimeStore()
    const store = readable(0, (set) => {
        const unsub = base.subscribe(set)
        return () => {
            unsub()
            sharedStores.delete(id)
        }
    })
    sharedStores.set(id, store)
    return store
}
