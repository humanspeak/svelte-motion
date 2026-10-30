import type { MotionDomProjectionAdapter } from '$lib/utils/motionDomProjection'
import { getContext, setContext } from 'svelte'

const MOTION_DOM_PROJECTION_CONTEXT_KEY = Symbol('svelte-motion:motion-dom-projection-parent')

/**
 * Publish the current upstream motion-dom projection adapter to descendants.
 *
 * Getter-backed for the same reason as `setVisualElementParent`: the adapter of
 * an `m` is created when its LazyMotion bundle arrives, which can be after its
 * children initialised.
 *
 * @param node Returns this component's projection adapter, or `null` while it
 *   has none (no features yet, or SSR).
 * @returns Nothing.
 *
 * @example
 * ```ts
 * let motionDomProjection = $state.raw<MotionDomProjectionAdapter | null>(null)
 * setMotionDomProjectionParent(() => motionDomProjection)
 * ```
 */
export const setMotionDomProjectionParent = (
    node: () => MotionDomProjectionAdapter | null
): void => {
    setContext<() => MotionDomProjectionAdapter | null>(MOTION_DOM_PROJECTION_CONTEXT_KEY, node)
}

/**
 * Read the nearest upstream motion-dom projection adapter.
 *
 * @returns A getter for the parent projection adapter. It returns `null` when
 *   no motion ancestor exists or the ancestor has no adapter yet.
 *
 * @example
 * ```ts
 * const readParent = getMotionDomProjectionParent()
 * const parent = readParent()
 * ```
 */
export const getMotionDomProjectionParent = (): (() => MotionDomProjectionAdapter | null) => {
    const read = getContext<(() => MotionDomProjectionAdapter | null) | undefined>(
        MOTION_DOM_PROJECTION_CONTEXT_KEY
    )
    return () => read?.() ?? null
}
