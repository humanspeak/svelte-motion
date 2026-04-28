import { resolveElement, type ElementOrGetter } from './dom.js'

/**
 * Reference set of DOM `ElementOrGetter` inputs keyed by name.
 *
 * Each value is either a resolved element, a getter that returns one (used
 * with Svelte's `bind:this` post-mount timing), or `undefined` when the
 * caller does not need this slot.
 */
export type AttachableRefs = Record<string, ElementOrGetter | undefined>

/**
 * Map of resolved elements supplied to `onAttach`. Slots whose ref was
 * `undefined` resolve to `undefined`.
 */
export type ResolvedRefs<R extends AttachableRefs> = { [K in keyof R]: HTMLElement | undefined }

export type AttachableConfig<R extends AttachableRefs> = {
    /** DOM refs that must resolve before `onAttach` runs. */
    refs: R
    /**
     * Called when every supplied ref has resolved. Receives a `stop` function
     * that synchronously tears down the attachment - useful for one-shot
     * latches that need to detach inside their own callback.
     *
     * Return a cleanup function for the standard "tear down on last
     * unsubscribe" path.
     */
    onAttach: (els: ResolvedRefs<R>, stop: VoidFunction) => VoidFunction | void
    /**
     * When this returns `true`, `subscribe` short-circuits without attaching.
     * Used by hooks that latch a value and stop observing (e.g. `once`).
     * Subscribers added after the latch increment the refcount but never
     * trigger `onAttach`; their unsubscribe is a clean no-op.
     */
    isLatched?: () => boolean
}

export type Attachable = {
    /**
     * Register a subscriber. Triggers `onAttach` on the first subscriber,
     * polls on `requestAnimationFrame` until refs resolve. Returns a release
     * function that cleans up when the last subscriber leaves.
     *
     * Callers must eventually unsubscribe; the rAF poll loop continues until
     * either every ref resolves or the last subscriber releases.
     */
    subscribe: () => () => void
}

/**
 * Builds a subscriber-refcounted DOM-attachment primitive. Both `useScroll`
 * and `useInView` use this to defer observer setup until a subscriber arrives,
 * poll for `bind:this` element resolution, and tear down on the last
 * unsubscribe.
 *
 * @param config Attachment configuration: refs to resolve, an `onAttach`
 *   callback that returns a cleanup function, and an optional `isLatched`
 *   short-circuit.
 * @returns An `Attachable` exposing `subscribe()` for use inside Svelte
 *   `readable(..., start)` callbacks.
 * @example
 * ```ts
 * const attachable = createAttachable({
 *     refs: { target },
 *     onAttach: ({ target }) => {
 *         const stopObserving = startObserver(target!, ...)
 *         return stopObserving
 *     }
 * })
 * return readable(initial, (set) => {
 *     const release = attachable.subscribe()
 *     return release
 * })
 * ```
 */
export const createAttachable = <R extends AttachableRefs>(
    config: AttachableConfig<R>
): Attachable => {
    let cleanup: VoidFunction | undefined
    let pollRaf = 0
    let subscriberCount = 0
    // When stop() runs synchronously inside onAttach, cleanup hasn't been
    // assigned yet. Defer the teardown so the just-returned disposer still
    // gets invoked.
    let attaching = false
    let stopRequestedDuringAttach = false

    const cancelPoll = () => {
        if (pollRaf) {
            cancelAnimationFrame(pollRaf)
            pollRaf = 0
        }
    }

    const stop = () => {
        cancelPoll()
        if (attaching) {
            stopRequestedDuringAttach = true
            return
        }
        if (cleanup) {
            const fn = cleanup
            cleanup = undefined
            fn()
        }
    }

    const tryAttach = () => {
        if (cleanup || config.isLatched?.()) return

        const els = {} as ResolvedRefs<R>
        let needsPoll = false
        for (const key of Object.keys(config.refs) as Array<keyof R>) {
            const ref = config.refs[key]
            const el = resolveElement(ref)
            if (ref && !el) needsPoll = true
            els[key] = el
        }
        if (needsPoll) {
            if (!pollRaf) {
                pollRaf = requestAnimationFrame(() => {
                    pollRaf = 0
                    tryAttach()
                })
            }
            return
        }

        attaching = true
        let result: VoidFunction | void
        try {
            result = config.onAttach(els, stop)
        } finally {
            attaching = false
        }
        if (typeof result === 'function') cleanup = result
        if (stopRequestedDuringAttach) {
            stopRequestedDuringAttach = false
            stop()
        }
    }

    return {
        subscribe: () => {
            subscriberCount++
            tryAttach()
            return () => {
                if (subscriberCount > 0) subscriberCount--
                if (subscriberCount > 0) return
                stop()
            }
        }
    }
}
