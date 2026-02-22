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
 */
export function getLayoutIdRegistry(): LayoutIdRegistry {
    return layoutIdRegistry
}
