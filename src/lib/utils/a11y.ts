import type { SvelteHTMLElements } from 'svelte/elements'

/**
 * Determines if an HTML element is natively focusable.
 *
 * Checks whether a given tag with provided attributes can receive keyboard
 * focus without needing an explicit `tabindex`. Elements are considered
 * natively focusable if they have `tabindex`, `tabIndex`, `contenteditable`,
 * or are inherently focusable tags like `button`, `input`, or anchors with `href`.
 *
 * @param tag - The HTML element tag name.
 * @param attrs - Attributes object that may contain focusability hints.
 * @returns `true` if the element is natively focusable, otherwise `false`.
 *
 * @example
 * ```typescript
 * isNativelyFocusable('button', {})                    // true
 * isNativelyFocusable('div', { tabindex: '0' })        // true
 * isNativelyFocusable('a', { href: '/home' })          // true
 * isNativelyFocusable('div', {})                       // false
 * ```
 */
export const isNativelyFocusable = (
    tag: keyof SvelteHTMLElements,
    attrs: Record<string, unknown> = {}
): boolean => {
    if ((attrs as Record<string, unknown>).tabindex != null) return true
    if ((attrs as Record<string, unknown>).tabIndex != null) return true
    if ((attrs as Record<string, unknown>).contenteditable != null) return true
    switch (tag) {
        case 'a':
            return Boolean((attrs as unknown as { href?: string }).href)
        case 'button':
        case 'input':
        case 'select':
        case 'textarea':
        case 'summary':
            return true
        default:
            return false
    }
}
