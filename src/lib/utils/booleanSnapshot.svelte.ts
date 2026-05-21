import { SvelteSet } from 'svelte/reactivity'

/**
 * Shared `{ current, subscribe }` shape returned by the Wave 2 boolean
 * snapshot hooks — `useReducedMotion`, `useReducedMotionConfig`,
 * `useInView`. `.current` is `$state`-backed; `.subscribe(run)` is the
 * Svelte readable store contract preserved for legacy consumers during
 * the Tier 2 migration.
 */
export type BooleanSnapshot = {
    /** Reactive read in Svelte 5 templates / `$derived` / `$effect`. */
    readonly current: boolean
    /** Svelte readable store contract — emits synchronously on subscribe. */
    subscribe: (run: (value: boolean) => void) => () => void
}

/**
 * Build a `{ current, subscribe }` snapshot + an internal `set`
 * function. Centralises the dedupe + subscriber-fanout that all three
 * boolean-snapshot hooks need.
 *
 * Returns a tuple so consumers can hand the snapshot to callers while
 * keeping `set` internal (it's not on the returned state object).
 *
 * Same-value writes via `set` are no-ops — saves a fanout call and
 * means callers don't need their own change-detection guard.
 *
 * @param initial Starting value for the `current` cell.
 * @returns A `[state, set]` tuple where `state` is the publicly-shared
 *   `{ current, subscribe }` and `set` is the internal updater the hook
 *   uses to push values from its event source.
 *
 * @example
 * ```ts
 * const [state, set] = createBooleanSnapshot(media.matches)
 * media.addEventListener('change', (e) => set(e.matches))
 * return state // { current, subscribe }
 * ```
 */
export const createBooleanSnapshot = (
    initial: boolean
): [BooleanSnapshot, (value: boolean) => void] => {
    let current = $state(initial)
    const subscribers = new SvelteSet<(value: boolean) => void>()

    const state: BooleanSnapshot = {
        get current() {
            return current
        },
        subscribe(run) {
            subscribers.add(run)
            run(current)
            return () => {
                subscribers.delete(run)
            }
        }
    }

    const set = (value: boolean) => {
        if (value === current) return
        current = value
        for (const sub of subscribers) sub(value)
    }

    return [state, set]
}
