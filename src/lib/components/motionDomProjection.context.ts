import type { MotionDomProjectionAdapter } from '$lib/utils/motionDomProjection'
import { getContext, setContext } from 'svelte'

const MOTION_DOM_PROJECTION_CONTEXT_KEY = Symbol('svelte-motion:motion-dom-projection-parent')

/**
 * Publish the current upstream motion-dom projection adapter to descendants.
 *
 * @param node Current component projection adapter, or `null` to clear.
 */
export const setMotionDomProjectionParent = (node: MotionDomProjectionAdapter | null): void => {
    setContext<MotionDomProjectionAdapter | null>(MOTION_DOM_PROJECTION_CONTEXT_KEY, node)
}

/**
 * Read the nearest upstream motion-dom projection adapter.
 *
 * @returns Parent projection adapter, or `null` when no motion ancestor exists.
 */
export const getMotionDomProjectionParent = (): MotionDomProjectionAdapter | null => {
    return getContext<MotionDomProjectionAdapter | null>(MOTION_DOM_PROJECTION_CONTEXT_KEY) ?? null
}
