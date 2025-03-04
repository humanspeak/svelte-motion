import { getContext, setContext } from 'svelte'
import type { MotionConfigProps } from '../types.js'

const key = 'motionConfig'

export const getMotionConfig = (): MotionConfigProps | undefined => {
    return getContext<MotionConfigProps | undefined>(key)
}

export const createMotionConfig = (motionConfig: MotionConfigProps): MotionConfigProps => {
    return setContext(key, motionConfig)
}
