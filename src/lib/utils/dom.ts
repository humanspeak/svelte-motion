/**
 * @fileoverview DOM utilities.
 * @module utils/dom
 */

/**
 * Type guard for DOM elements that is resilient across realms/iframes.
 *
 * Avoids relying on `instanceof HTMLElement`, which can fail when elements
 * originate from a different realm (e.g., an iframe). Instead, checks for
 * the presence of a callable `getBoundingClientRect`, which is available on
 * all `Element` nodes.
 *
 * @param v Unknown value to test.
 * @return Whether the value is a DOM `Element`.
 */
export const isDomElement = (v: unknown): v is Element => {
    return !!v && typeof (v as Element).getBoundingClientRect === 'function'
}

/**
 * An element reference - either an element directly or a getter function
 * that returns one. Getters defer resolution past mount, which is useful
 * with Svelte's `bind:this` where the element isn't available synchronously.
 *
 * Both `null` and `undefined` returns from the getter are normalised to
 * `undefined` by `resolveElement`, so either nullable shape works.
 */
export type ElementOrGetter = HTMLElement | (() => HTMLElement | null | undefined)

/**
 * Resolves an `ElementOrGetter` to an `HTMLElement`, or `undefined` if not
 * yet available (e.g. a getter is supplied but the bound element hasn't
 * mounted).
 *
 * Coerces a `null` getter result to `undefined` so the common
 * `let el: HTMLElement | null = null` `bind:this` pattern lines up with the
 * declared return type.
 *
 * @param ref Element or getter to resolve.
 * @returns The resolved element, or `undefined` when not yet available.
 * @example
 * ```ts
 * let node: HTMLElement | null = null
 * resolveElement(() => node) // => undefined until bind:this fires
 * ```
 */
export const resolveElement = (ref?: ElementOrGetter): HTMLElement | undefined => {
    if (!ref) return undefined
    const value = typeof ref === 'function' ? ref() : ref
    return value ?? undefined
}
