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
 * - `has(id)` — whether an unconsumed entry for `id` is in its handoff window, without
 *   consuming it. A mounting element uses it to tell it is taking over a `layoutId`.
 *
 * Entries live through a handoff window: two animation frames and at least
 * {@link HANDOFF_MS} after the snapshot, extended while any `AnimatePresence` has an exit in
 * flight (see {@link holdLayoutIdHandoffs}). An entry nobody consumed by then is released, so
 * unique `layoutId`s don't keep detached elements alive and a much later arrival doesn't
 * animate from a stale rect. Upstream releases empty shared stacks at the end of the update
 * pass rather than on unmount, because a replacement mounting in the same commit resumes from
 * them (motion-dom `create-projection-node.ts` `clearAllSnapshots` @ v14.5.0, #3940).
 */
export type LayoutIdRegistry = {
    snapshot(id: string, rect: DOMRect, transition?: AnimationOptions, owner?: object): void
    consume(id: string, consumer?: object): LayoutIdEntry | undefined
    /**
     * Whether an unconsumed snapshot for `id` is in its handoff window. Does not consume it.
     *
     * @param id - The (scoped) layoutId to look up.
     * @returns `true` while an entry for `id` is waiting to be consumed.
     */
    has(id: string): boolean
}

/**
 * Module-level singleton registry shared across the entire component tree.
 * This matches React Framer Motion's behavior where layoutId is shared globally
 * (or within a LayoutGroup, which we can add later).
 */
const entries = new Map<string, LayoutIdEntry>()

/**
 * Minimum time an unconsumed entry survives after its snapshot. Covers an arriving element's
 * frame to reach `isLoaded === 'ready'` (plus Playwright's 10 ms settle) with margin.
 */
const HANDOFF_MS = 100

/** Per-entry release bookkeeping: the latest snapshot's token and when it was written. */
const releaseStamps = new Map<string, { token: number; at: number }>()
let nextToken = 0

/** Number of in-flight `AnimatePresence` exits deferring releases. */
let holds = 0

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/**
 * Drop the entry for `id` if it is still the snapshot stamped `token`, nobody consumed it, the
 * window has elapsed and no exit is holding handoffs. A held check no-ops; releasing the last
 * hold restarts the window for every entry.
 */
const releaseIfStale = (id: string, token: number) => {
    const stamp = releaseStamps.get(id)
    if (!stamp || stamp.token !== token || holds > 0) return
    const remaining = HANDOFF_MS - (now() - stamp.at)
    if (remaining > 0) {
        setTimeout(() => releaseIfStale(id, token), remaining)
        return
    }
    releaseStamps.delete(id)
    entries.delete(id)
}

/** Start the handoff window for `id`: two frames, then at least {@link HANDOFF_MS}. */
const scheduleRelease = (id: string) => {
    const token = ++nextToken
    releaseStamps.set(id, { token, at: now() })
    if (typeof requestAnimationFrame === 'undefined') {
        setTimeout(() => releaseIfStale(id, token), HANDOFF_MS)
        return
    }
    requestAnimationFrame(() => {
        requestAnimationFrame(() => releaseIfStale(id, token))
    })
}

/**
 * Defer releasing unconsumed `layoutId` snapshots while an exit is in flight.
 *
 * In `AnimatePresence mode="wait"` the arriving element mounts only after the departing one's
 * exit finishes, which can be well past the handoff window. Each in-flight exit takes one hold;
 * when the last hold is released every remaining entry gets a fresh window.
 *
 * @returns A release function. Calling it more than once has no further effect.
 *
 * @example
 * ```ts
 * const release = holdLayoutIdHandoffs()
 * await exitAnimation.finished
 * release()
 * ```
 */
export const holdLayoutIdHandoffs = (): (() => void) => {
    holds += 1
    let released = false
    return () => {
        if (released) return
        released = true
        holds -= 1
        if (holds === 0) {
            for (const id of entries.keys()) scheduleRelease(id)
        }
    }
}

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
    has: (id) => entries.has(id),
    snapshot(id, rect, transition, owner) {
        entries.set(id, { rect, transition, owner })
        scheduleRelease(id)
    },
    consume(id, consumer) {
        const entry = entries.get(id)
        if (!entry) return undefined
        entries.delete(id)
        releaseStamps.delete(id)
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

/**
 * Number of entries currently in the registry. Test-only; not exported from the package.
 *
 * @internal
 * @returns The registry size.
 */
export const __layoutIdRegistrySize = (): number => entries.size
