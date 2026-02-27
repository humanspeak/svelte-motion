import { writable, type Readable } from 'svelte/store'

export type MotionValue<T = number> = Readable<T> & {
    set: (v: T) => void
    get: () => T
}

export const useMotionValue = <T = number>(initial: T): MotionValue<T> => {
    let current = initial
    const store = writable(initial)
    return {
        subscribe: store.subscribe,
        set: (v: T) => {
            current = v
            store.set(v)
        },
        get: () => current
    }
}
