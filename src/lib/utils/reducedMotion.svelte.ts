import { createBooleanSnapshot, type BooleanSnapshot } from '$lib/utils/booleanSnapshot.svelte.js'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * State returned by {@link useReducedMotion}.
 */
export type ReducedMotionState = BooleanSnapshot

/**
 * Returns a `{ current, subscribe }` object that reflects the user's
 * `prefers-reduced-motion` setting. Mirrors framer-motion's
 * `useReducedMotion` adapted for Svelte 5 runes.
 *
 * - `state.current` is reactive — read it in templates / `$derived` /
 *   `$effect` and it tracks the underlying `matchMedia` listener.
 * - `state.subscribe(run)` is the Svelte readable store contract:
 *   synchronously emits the current value, then re-emits on every change.
 *   Kept for compat with downstream hooks that still consume Svelte
 *   readables until the Tier 2 wave lands.
 *
 * Diverges from React framer-motion's plain `boolean | null` return for
 * the same reason as `useCycle`: a `$state`-backed value must live on an
 * object so reads inside getters preserve tracking under runes.
 *
 * SSR-safe: returns a static `{ current: false }` when `window` /
 * `matchMedia` is unavailable, including when `matchMedia` throws.
 *
 * The media listener is bound to the surrounding reactive scope via
 * `$effect` — call this from a component `<script>` block (the standard
 * hook contract). On unmount the listener is detached automatically.
 *
 * @returns A `ReducedMotionState` reflecting the OS reduced-motion setting.
 * @see https://motion.dev/docs/react-reduced-motion
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useReducedMotion } from '@humanspeak/svelte-motion'
 *
 *   const reduced = useReducedMotion()
 * </script>
 *
 * <div style:transform={reduced.current ? 'none' : 'rotate(45deg)'} />
 * ```
 */
export const useReducedMotion = (): ReducedMotionState => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return staticState(false)
    }

    let media: MediaQueryList
    try {
        media = window.matchMedia(REDUCED_MOTION_QUERY)
    } catch {
        return staticState(false)
    }

    const [state, set] = createBooleanSnapshot(media.matches)
    const handler = (event: MediaQueryListEvent) => set(event.matches)

    $effect(() => {
        // Resync on (re-)mount in case the OS preference changed while
        // the component was torn down between effect runs.
        set(media.matches)
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', handler)
            return () => media.removeEventListener('change', handler)
        }
        // Safari < 14 / older WebKit — addListener/removeListener fallback.
        media.addListener(handler)
        return () => media.removeListener(handler)
    })

    return state
}

/**
 * SSR / no-matchMedia fallback. Static value, no listeners; `subscribe`
 * is a one-shot sync emit + no-op unsubscribe so consumers can wire it
 * the same way they do the live state.
 */
const staticState = (value: boolean): ReducedMotionState => ({
    get current() {
        return value
    },
    subscribe(run) {
        run(value)
        return () => undefined
    }
})
