import type { AnimationOptions } from 'motion'

/**
 * Snapshot stored for a layoutId when an element unmounts.
 */
type LayoutIdEntry = {
    rect: DOMRect
    transition?: AnimationOptions
    /** The element that wrote the entry, when it said so. */
    owner?: object
}

/**
 * Registry that stores last-known rect + transition for each layoutId.
 *
 * - `snapshot(id, rect, transition, owner)` — called when an element with a layoutId unmounts
 *   (or its `layoutId` turns off). `owner` is the element writing the entry.
 * - `consume(id, consumer)` — called by a newly mounted element. Returns and **deletes** the
 *   entry (one-shot). An element never consumes its own entry: when its `layoutId` turns back
 *   on it is still the lead of its own shared-layout stack upstream, so nothing animates
 *   (framer-motion `MeasureLayout.tsx` @ v14.2.0, 47-49 / 154-155). Its stale entry is
 *   dropped, so a later arrival doesn't animate from it either.
 */
export type LayoutIdRegistry = {
    snapshot(id: string, rect: DOMRect, transition?: AnimationOptions, owner?: object): void
    consume(id: string, consumer?: object): LayoutIdEntry | undefined
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
 * layoutIdRegistry.snapshot('hero', element.getBoundingClientRect(), {}, element)
 * const entry = layoutIdRegistry.consume('hero', otherElement) // returns and deletes
 * ```
 */
export const layoutIdRegistry: LayoutIdRegistry = {
    snapshot(id, rect, transition, owner) {
        entries.set(id, { rect, transition, owner })
    },
    consume(id, consumer) {
        const entry = entries.get(id)
        if (!entry) return undefined
        entries.delete(id)
        if (consumer !== undefined && entry.owner === consumer) return undefined
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
