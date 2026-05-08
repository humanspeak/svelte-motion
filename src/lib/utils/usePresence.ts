import { getPresenceChildContext } from '$lib/utils/presence'

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
 * Svelte 5 reactive contexts (`$derived`, `$effect`, template). For non-
 * reactive snapshots, prefer `usePresence()` which exposes the same state
 * alongside the `safeToRemove` callback.
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

/**
 * Returns `[isPresent, safeToRemove]`. `isPresent` reflects the wrapper's
 * presence state; `safeToRemove` is the callback to invoke once a custom exit
 * animation finishes. Calling it triggers the actual unmount and decrements
 * the parent `<AnimatePresence>` exit-completion count.
 *
 * Outside of a `<PresenceChild>` returns `[true, null]` — the consumer is
 * effectively always present and there is nothing to safely remove.
 *
 * `safeToRemove` is idempotent and versioned: a stale callback from a
 * canceled exit cycle (re-entry before the consumer signaled completion) is
 * a no-op.
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
 *   const presence = $derived(usePresence())
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
 *
 * <div bind:this={node}>…</div>
 * ```
 */
export const usePresence = (): UsePresenceState => {
    const context = getPresenceChildContext()
    if (!context) return [true, null]
    return context.isPresent ? [true, null] : [false, context.safeToRemove]
}
