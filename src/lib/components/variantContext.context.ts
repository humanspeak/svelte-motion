import { getContext, setContext } from 'svelte'
import type { Writable } from 'svelte/store'

const VARIANT_CONTEXT_KEY = Symbol('variant-context')
const INITIAL_FALSE_CONTEXT_KEY = Symbol('initial-false-context')

/**
 * Provide a writable store for the current variant key so children can
 * react to changes over time (true inheritance like Framer Motion).
 *
 * @param store Writable store holding the current variant name.
 */
export const setVariantContext = (store: Writable<string | undefined>): void => {
    setContext<Writable<string | undefined>>(VARIANT_CONTEXT_KEY, store)
}

/**
 * Read the parent's variant store (if any). Children subscribe to this store
 * to inherit and react to parent `animate` changes.
 *
 * @returns The parent variant store, or `undefined` if none exists.
 */
export const getVariantContext = (): Writable<string | undefined> | undefined => {
    return getContext<Writable<string | undefined> | undefined>(VARIANT_CONTEXT_KEY)
}

/**
 * Set initial={false} in context so children inherit it.
 *
 * @param value Whether the parent has `initial={false}`.
 */
export const setInitialFalseContext = (value: boolean): void => {
    setContext<boolean>(INITIAL_FALSE_CONTEXT_KEY, value)
}

/**
 * Check if parent has initial={false}.
 *
 * @returns `true` if a parent set `initial={false}`, otherwise `false`.
 */
export const getInitialFalseContext = (): boolean => {
    return getContext<boolean>(INITIAL_FALSE_CONTEXT_KEY) ?? false
}
