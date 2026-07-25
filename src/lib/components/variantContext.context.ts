import { getContext, setContext } from 'svelte'
import type { Writable } from 'svelte/store'

const VARIANT_CONTEXT_KEY = Symbol('variant-context')
const INITIAL_FALSE_CONTEXT_KEY = Symbol('initial-false-context')
const INITIAL_VARIANT_CONTEXT_KEY = Symbol('initial-variant-context')
const CUSTOM_CONTEXT_KEY = Symbol('custom-context')

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

/**
 * Publish the current component's `initial` VARIANT LABEL to descendants.
 *
 * The sibling of {@link setVariantContext} for the other half of upstream's
 * variant context. `getCurrentTreeVariants`
 * (`framer-motion/src/context/MotionContext/utils.ts`) publishes BOTH labels: a
 * variant-controlling node contributes its own `initial`/`animate` labels, and a
 * non-controlling node passes its parent's straight through. Without the
 * `initial` half, children that carry only a `variants` map have nothing to seed
 * their first paint from and render at their natural pose (#449, plan 006).
 *
 * A plain value, not a store: `makeLatestValues` consumes `context.initial` once
 * at VisualElement creation, so there is nothing to react to afterwards — unlike
 * the animate label, which drives ongoing animations. Matches the convention of
 * {@link setInitialFalseContext}.
 *
 * `initial={false}` is NOT carried here — it stays on the boolean channel
 * ({@link setInitialFalseContext}), exactly as upstream keeps them separate.
 *
 * @param label The variant label (or label list) to publish, or `undefined`.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * setInitialVariantContext('closed')
 * ```
 */
export const setInitialVariantContext = (label: string | string[] | undefined): void => {
    setContext<string | string[] | undefined>(INITIAL_VARIANT_CONTEXT_KEY, label)
}

/**
 * Read the nearest motion ancestor's `initial` variant label.
 *
 * @returns The inherited label (or label list), or `undefined` when no ancestor
 *     published one.
 *
 * @example
 * ```ts
 * const inherited = getInitialVariantContext()
 * ```
 */
export const getInitialVariantContext = (): string | string[] | undefined => {
    return getContext<string | string[] | undefined>(INITIAL_VARIANT_CONTEXT_KEY)
}

/**
 * Provide a writable store carrying the current motion component's
 * `custom` value so descendant motion components without their own
 * `custom` prop can inherit it — and re-resolve their variants when the
 * parent's `custom` changes.
 *
 * Mirrors framer-motion's variant-tree custom propagation. A store
 * (rather than a snapshot) lets descendants react to changes the parent
 * makes after mount.
 *
 * @param store Writable store holding the current component's effective `custom`.
 */
export const setCustomContext = (store: Writable<unknown>): void => {
    setContext<Writable<unknown>>(CUSTOM_CONTEXT_KEY, store)
}

/**
 * Read the nearest ancestor's `custom` store (if any).
 *
 * @returns The ancestor's writable store, or `undefined` when no motion
 *     ancestor has set one.
 */
export const getCustomContext = (): Writable<unknown> | undefined => {
    return getContext<Writable<unknown> | undefined>(CUSTOM_CONTEXT_KEY)
}
