import type { AnimationOptions, DOMKeyframesDefinition } from 'motion'
import type { Snippet } from 'svelte'

export type MotionInitial = DOMKeyframesDefinition | undefined
export type MotionAnimate = DOMKeyframesDefinition | undefined
export type MotionTransition = AnimationOptions | undefined
export type MotionWhileTap = DOMKeyframesDefinition | undefined

export type HTMLElementProps = {
    children?: Snippet
    [key: string]: unknown
}

export type HTMLVoidElementProps = {
    [key: string]: unknown
} & {
    children?: never
}
