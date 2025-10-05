import { getContext, setContext } from 'svelte'
import type { Writable } from 'svelte/store'

const VARIANT_CONTEXT_KEY = Symbol('variant-context')

/**
 * Provide a writable store for the current variant key so children can
 * react to changes over time (true inheritance like Framer Motion).
 */
export function setVariantContext(store: Writable<string | undefined>): void {
    setContext<Writable<string | undefined>>(VARIANT_CONTEXT_KEY, store)
}

/**
 * Read the parent's variant store (if any). Children subscribe to this store
 * to inherit and react to parent `animate` changes.
 */
export function getVariantContext(): Writable<string | undefined> | undefined {
    return getContext<Writable<string | undefined> | undefined>(VARIANT_CONTEXT_KEY)
}
