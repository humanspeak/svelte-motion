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
 */
export type ElementOrGetter = HTMLElement | (() => HTMLElement | undefined)

/**
 * Resolves an `ElementOrGetter` to an `HTMLElement`, or `undefined` if not
 * yet available (e.g. a getter is supplied but the bound element hasn't
 * mounted).
 */
export const resolveElement = (ref?: ElementOrGetter): HTMLElement | undefined => {
    if (!ref) return undefined
    return typeof ref === 'function' ? ref() : ref
}
