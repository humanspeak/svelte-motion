import type { SvelteHTMLElements } from 'svelte/elements'

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
