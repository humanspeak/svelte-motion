import type { AnimationOptions } from 'motion'
import { getContext, setContext } from 'svelte'

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

const LAYOUT_ID_CONTEXT = Symbol('layout-id-registry')

/**
 * Create a new `LayoutIdRegistry` backed by a simple Map.
 */
export function createLayoutIdRegistry(): LayoutIdRegistry {
    const entries = new Map<string, LayoutIdEntry>()

    return {
        snapshot(id, rect, transition) {
            entries.set(id, { rect, transition })
        },
        consume(id) {
            const entry = entries.get(id)
            if (entry) entries.delete(id)
            return entry
        }
    }
}

/**
 * Retrieve the `LayoutIdRegistry` from Svelte context.
 */
export function getLayoutIdRegistry(): LayoutIdRegistry | undefined {
    try {
        return getContext<LayoutIdRegistry | undefined>(LAYOUT_ID_CONTEXT)
    } catch {
        return undefined
    }
}

/**
 * Set the `LayoutIdRegistry` in Svelte context.
 */
export function setLayoutIdRegistry(registry: LayoutIdRegistry): void {
    setContext(LAYOUT_ID_CONTEXT, registry)
}
