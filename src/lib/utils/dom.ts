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
