import type { DOMKeyframesDefinition } from 'motion'

export const isEmpty = (obj: Record<string, unknown> | DOMKeyframesDefinition | undefined) => {
    if (!obj) return true
    for (const _ in obj) return false
    return true
}

export const isNotEmpty = (obj: Record<string, unknown> | DOMKeyframesDefinition | undefined) => {
    return !isEmpty(obj)
}

export function getCommonKeys<T extends Record<string, unknown>>(obj1: T, obj2: T): (keyof T)[] {
    return Object.keys(obj1).filter((key) => key in obj2) as (keyof T)[]
}
