import type { MotionConfigProps } from '$lib/types.js'
import { getContext, setContext } from 'svelte'

const key = 'motionConfig'

export const getMotionConfig = (): MotionConfigProps | undefined => {
    return getContext<MotionConfigProps | undefined>(key)
}

export const createMotionConfig = (motionConfig: MotionConfigProps): MotionConfigProps => {
    return setContext(key, motionConfig)
}
