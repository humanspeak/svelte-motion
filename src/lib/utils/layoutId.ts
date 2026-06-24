import type { AnimationOptions } from 'motion'

/**
 * Snapshot stored for a layoutId when an element unmounts.
 */
type LayoutIdEntry = {
    rect: DOMRect
    transition?: AnimationOptions
}

/**
 * Registry that stores last-known rect + transition for each layoutId.
 *
 * - `snapshot(id, rect, transition)` — called when an element with a layoutId unmounts.
 * - `consume(id)` — called by a newly mounted element. Returns and **deletes** the entry (one-shot).
 */
export type LayoutIdRegistry = {
    snapshot(id: string, rect: DOMRect, transition?: AnimationOptions): void
    consume(id: string): LayoutIdEntry | undefined
}

/**
 * Module-level singleton registry shared across the entire component tree.
 * This matches React Framer Motion's behavior where layoutId is shared globally
 * (or within a LayoutGroup, which we can add later).
 */
const entries = new Map<string, LayoutIdEntry>()

/**
 * The global singleton `LayoutIdRegistry` shared across the component tree.
 *
 * Bridges `layoutId` shared-element transitions: an unmounting element calls
 * `snapshot` to store its last-known rect, and a newly mounted element with the
 * same id calls `consume` to read and clear it (one-shot). Prefer
 * {@link getLayoutIdRegistry} at call sites for indirection.
 *
 * @example
 * ```ts
 * layoutIdRegistry.snapshot('hero', element.getBoundingClientRect())
 * const entry = layoutIdRegistry.consume('hero') // returns and deletes
 * ```
 */
export const layoutIdRegistry: LayoutIdRegistry = {
    snapshot(id, rect, transition) {
        entries.set(id, { rect, transition })
    },
    consume(id) {
        const entry = entries.get(id)
        if (entry) entries.delete(id)
        return entry
    }
}

/**
 * Get the global layoutId registry.
 *
 * @returns The singleton `LayoutIdRegistry` instance.
 *
 * @example
 * ```ts
 * const registry = getLayoutIdRegistry()
 * registry.snapshot('hero', element.getBoundingClientRect())
 * const entry = registry.consume('hero') // one-shot: returns and deletes
 * ```
 */
export const getLayoutIdRegistry = (): LayoutIdRegistry => {
    return layoutIdRegistry
}
