import type { FeatureBundle } from '$lib/features'
import { getContext, setContext } from 'svelte'

/**
 * Context value published by `<LazyMotion>` for descendant motion elements.
 */
export type LazyMotionContext = {
    /** Returns the currently active feature bundle. */
    getFeatures: () => FeatureBundle
    /** Returns whether an async bundle has finished loading. */
    getIsLoaded: () => boolean
    /**
     * Strict LazyMotion usage checks. In development, rendering a `motion`
     * component inside throws; render `m` components instead (Reorder: import
     * it from `@humanspeak/svelte-motion/m`).
     */
    strict: boolean
}

const key = Symbol('lazyMotion')

/**
 * Reads the nearest LazyMotion context.
 *
 * @returns The active LazyMotion context, or undefined outside LazyMotion.
 */
export const getLazyMotionContext = (): LazyMotionContext | undefined => {
    return getContext<LazyMotionContext | undefined>(key)
}

/**
 * Publishes a LazyMotion context for descendant motion elements.
 *
 * @param context - LazyMotion context to publish.
 * @returns The same context value returned by Svelte's setContext.
 */
export const setLazyMotionContext = (context: LazyMotionContext): LazyMotionContext => {
    return setContext(key, context)
}
