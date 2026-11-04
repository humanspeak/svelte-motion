import { getAnimatePresenceContext, getPresenceChildContext } from '$lib/utils/presence'
import { DEV } from 'esm-env'
import { onDestroy } from 'svelte'

/**
 * Tuple returned by {@link usePresence}, matching framer-motion's shape:
 * `[true, null]` while present (or when not inside a `PresenceChild`), and
 * `[false, () => void]` after the wrapper enters its exit hold.
 */
export type UsePresenceState = [true, null] | [false, () => void]

/**
 * Returns whether the calling component is currently present in its parent
 * `<PresenceChild>`. While the wrapper holds the component for an exit, this
 * flips to `false` so the consumer can branch (render different markup, run
 * a custom exit animation, etc.).
 *
 * Outside of a `<PresenceChild>` always returns `true`.
 *
 * Reactivity note: the boolean tracks the wrapper's state and updates in
 * Svelte 5 reactive contexts (`$derived`, `$effect`, template). Unlike
 * `usePresence()`, it never registers with the wrapper, so it never holds the
 * exit. `usePresence()` is called once at init and read reactively; it exposes
 * the same state alongside the `safeToRemove` callback.
 *
 * @returns `true` while present, `false` while exiting.
 * @see https://motion.dev/docs/react-use-is-present
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useIsPresent } from '@humanspeak/svelte-motion'
 *   const isPresent = $derived(useIsPresent())
 * </script>
 * <div class:exiting={!isPresent}>{isPresent ? 'live' : 'goodbye'}</div>
 * ```
 */
export const useIsPresent = (): boolean => {
    const context = getPresenceChildContext()
    return context ? context.isPresent : true
}

// Module counter for participant ids. The ids are never rendered, so the
// server and client sequences can't mismatch.
let nextPresenceId = 0

const LEGACY_USE_PRESENCE_WARNING =
    'usePresence() was called inside a reactive context (for example `$derived(usePresence())`), ' +
    "so it can't register with its PresenceChild. The wrapper keeps the old behaviour: it doesn't " +
    'leave on its own and safeToRemove() releases the whole wrapper. Call it once at component ' +
    'init instead: `const presence = usePresence()`, then read `presence` in $effect or the ' +
    'template. See https://motion.svelte.page/docs/use-presence'

/**
 * Returns `[isPresent, safeToRemove]` for the nearest `<PresenceChild>` (or
 * owned `<AnimatePresence present>` child), as Motion's `usePresence()`.
 *
 * Call it **once, at component init** (`const presence = usePresence()`). It
 * registers the component as one participant of its wrapper, and unregisters
 * it on destroy (`use-presence.ts:52-57 @ v14.7.1`). The returned value is a
 * frozen two-item array whose items follow the wrapper: destructure it inside
 * `$effect`, `$derived` or the template (`const [isPresent, safeToRemove] =
 * presence`) to stay reactive. Destructuring at the top level of `<script>`
 * takes a one-time snapshot.
 *
 * Once the exit starts, `safeToRemove` completes **only this participant**
 * (`use-presence.ts:59-62`). The wrapper leaves when every participant is
 * done: motion exits, layout measurement and other `usePresence()`
 * consumers. Its identity is stable within one exit cycle; a callback from a
 * canceled cycle (re-entry before it was called) is a no-op.
 *
 * Outside of a `<PresenceChild>` returns `[true, null]`: the consumer is
 * effectively always present and there is nothing to safely remove.
 *
 * Deprecated: calling it inside a reactive context (the old
 * `$derived(usePresence())` pattern) can't register once. Such a call returns
 * a snapshot whose `safeToRemove` releases the whole wrapper, and the wrapper
 * keeps the old rule that an exit with nothing registered holds until that
 * release. Development builds warn once per wrapper.
 *
 * @returns `[true, null]` while present (or outside any `PresenceChild`),
 *     `[false, () => void]` while the wrapper holds the component for exit.
 * @see https://motion.dev/docs/react-use-presence
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { usePresence } from '@humanspeak/svelte-motion'
 *
 *   let node: HTMLElement | undefined = $state()
 *   const presence = usePresence()
 *
 *   $effect(() => {
 *     const [isPresent, safeToRemove] = presence
 *     if (isPresent || !node) return
 *     const onEnd = () => safeToRemove()
 *     node.addEventListener('transitionend', onEnd, { once: true })
 *     node.classList.add('exiting')
 *     return () => node?.removeEventListener('transitionend', onEnd)
 *   })
 * </script>
 * ```
 */
export const usePresence = (): UsePresenceState => {
    const context = getPresenceChildContext()
    if (!context) return [true, null]

    if ($effect.tracking()) {
        // Legacy `$derived(usePresence())`: re-called on every change, so it
        // can't register once. Keep the old whole-wrapper rules.
        const first = context.markLegacyManual?.() ?? false
        if (first && DEV) console.warn(LEGACY_USE_PRESENCE_WARNING)
        return context.isPresent ? [true, null] : [false, context.safeToRemove]
    }

    const id = `use-presence-${nextPresenceId++}`
    // Upstream registers in a client-only `useEffect` (use-presence.ts:52-57).
    if (typeof window !== 'undefined') onDestroy(context.register(id))

    let cachedFor: ((id: string) => void) | undefined
    let cached: (() => void) | undefined
    // One callback per exit cycle: the cycle's completer changes on every
    // exit start, and the registry ignores a stale one.
    const cycleSafeToRemove = () => {
        const complete = context.onExitComplete
        if (complete !== cachedFor || !cached) {
            cachedFor = complete
            cached = () => complete(id)
        }
        return cached
    }

    const state = [] as unknown as UsePresenceState
    Object.defineProperties(state, {
        0: { enumerable: true, get: () => context.isPresent },
        1: { enumerable: true, get: () => (context.isPresent ? null : cycleSafeToRemove()) }
    })
    Object.freeze(state)
    return state
}

/**
 * Returns the nearest `<AnimatePresence custom={...}>` data.
 *
 * This mirrors Motion's `usePresenceData()` hook. It is useful for children
 * that need the latest parent presence data while rendering enter/exit
 * keyframes, for example directional slideshow controls.
 *
 * Outside of `<AnimatePresence>`, this returns `undefined`.
 *
 * @typeParam T Expected custom data type.
 * @returns The current AnimatePresence custom data, or `undefined` outside a
 *     presence boundary.
 * @see https://motion.dev/docs/react-use-presence-data
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { usePresenceData } from '@humanspeak/svelte-motion'
 *
 *   const direction = $derived(usePresenceData<1 | -1>() ?? 1)
 * </script>
 * ```
 */
export const usePresenceData = <T = unknown>(): T | undefined => {
    const context = getAnimatePresenceContext()
    return context ? (context.custom as T) : undefined
}
