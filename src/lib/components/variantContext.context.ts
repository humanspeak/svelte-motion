import { getContext, setContext } from 'svelte'
import type { Writable } from 'svelte/store'

const VARIANT_CONTEXT_KEY = Symbol('variant-context')
const INITIAL_FALSE_CONTEXT_KEY = Symbol('initial-false-context')

/**
 * Exposes a writable store holding the current variant key to descendant components via Svelte context.
 *
 * @param store - Writable that contains the current variant key or `undefined`
 */
export function setVariantContext(store: Writable<string | undefined>): void {
    setContext<Writable<string | undefined>>(VARIANT_CONTEXT_KEY, store)
}

/**
 * Retrieve the parent's variant writable store from Svelte context.
 *
 * @returns The parent's `Writable<string | undefined>` variant store, or `undefined` if not present.
 */
export function getVariantContext(): Writable<string | undefined> | undefined {
    return getContext<Writable<string | undefined> | undefined>(VARIANT_CONTEXT_KEY)
}

/**
 * Store an initial={false} flag in Svelte context for descendant components.
 *
 * @param value - Whether descendants should treat `initial` as `false`; `true` sets the flag, `false` clears it
 */
export function setInitialFalseContext(value: boolean): void {
    setContext<boolean>(INITIAL_FALSE_CONTEXT_KEY, value)
}

/**
 * Determine whether an ancestor component set `initial={false}` in context.
 *
 * @returns `true` if a parent provided `initial={false}`, `false` otherwise.
 */
export function getInitialFalseContext(): boolean {
    return getContext<boolean>(INITIAL_FALSE_CONTEXT_KEY) ?? false
}