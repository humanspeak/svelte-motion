import type { MotionConfigProps } from '$lib/types.js'
import { getContext, setContext } from 'svelte'

const key = Symbol('motionConfig')

/**
 * Retrieve the current motion configuration from Svelte component context.
 *
 * @returns The active `MotionConfigProps`, or `undefined` if none was set by a parent.
 */
export const getMotionConfig = (): MotionConfigProps | undefined => {
    return getContext<MotionConfigProps | undefined>(key)
}

/**
 * Provide motion configuration to descendant components via Svelte context.
 *
 * @param motionConfig The configuration to propagate (e.g. `reducedMotion`, `transition`).
 * @returns The same `MotionConfigProps` that was set.
 */
export const createMotionConfig = (motionConfig: MotionConfigProps): MotionConfigProps => {
    return setContext(key, motionConfig)
}
