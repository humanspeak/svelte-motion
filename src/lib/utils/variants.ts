import type { MotionAnimate, MotionExit, MotionInitial, Variants } from '$lib/types'
import type { DOMKeyframesDefinition } from 'motion'

export function resolveVariant(
    variants: Variants | undefined,
    key: string | undefined
): DOMKeyframesDefinition | undefined {
    if (!variants || !key) return undefined
    return variants[key]
}

export function resolveInitial(
    initial: MotionInitial,
    variants: Variants | undefined
): DOMKeyframesDefinition | false | undefined {
    if (initial === false) return false
    if (initial === undefined) return undefined
    if (typeof initial === 'string') return resolveVariant(variants, initial)
    return initial as DOMKeyframesDefinition
}

export function resolveAnimate(
    animate: MotionAnimate,
    variants: Variants | undefined
): DOMKeyframesDefinition | undefined {
    if (animate === undefined) return undefined
    if (typeof animate === 'string') return resolveVariant(variants, animate)
    return animate as DOMKeyframesDefinition
}

export function resolveExit(
    exit: MotionExit,
    variants: Variants | undefined
): DOMKeyframesDefinition | undefined {
    if (exit === undefined) return undefined
    if (typeof exit === 'string') return resolveVariant(variants, exit)
    return exit as DOMKeyframesDefinition
}
