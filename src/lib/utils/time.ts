import { readable, type Readable } from 'svelte/store'

const sharedStores = new Map<string, Readable<number>>()

const createTimeStore = (): Readable<number> => {
    if (typeof window === 'undefined') return readable(0, () => {})
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

export const useTime = (id?: string): Readable<number> => {
    if (!id) return createTimeStore()
    if (typeof window === 'undefined') return readable(0, () => {})
    const existing = sharedStores.get(id)
    if (existing) return existing
    const store = readable(0, (set) => {
        const start = performance.now()
        let raf = 0
        /* c8 ignore start */
        const loop = (t: number) => {
            set(t - start)
            raf = requestAnimationFrame(loop)
        }
        /* c8 ignore stop */
        raf = requestAnimationFrame(loop)
        return () => {
            cancelAnimationFrame(raf)
            sharedStores.delete(id)
        }
    })
    sharedStores.set(id, store)
    return store
}
