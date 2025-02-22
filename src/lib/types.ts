import type { AnimationOptions, DOMKeyframesDefinition } from 'motion'
import type { Snippet } from 'svelte'

export type MotionInitial = DOMKeyframesDefinition | undefined
export type MotionAnimate = DOMKeyframesDefinition | undefined
export type MotionTransition = AnimationOptions | undefined
export type MotionWhileTap = DOMKeyframesDefinition | undefined

// Base motion props that all elements share
export type MotionProps = {
    initial?: MotionInitial
    animate?: MotionAnimate
    transition?: MotionTransition
    whileTap?: MotionWhileTap
    style?: string
    class?: string
}

// Props for regular HTML elements
export type HTMLElementProps = MotionProps & {
    children?: Snippet
    [key: string]: unknown
}

// Props for void elements (no children allowed)
export type HTMLVoidElementProps = MotionProps & {
    [key: string]: unknown
} & {
    children?: never
}
