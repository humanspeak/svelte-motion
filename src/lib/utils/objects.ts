import type { DOMKeyframesDefinition } from 'motion'

export const isEmpty = (obj: Record<string, unknown> | DOMKeyframesDefinition | undefined) => {
    if (!obj) return true
    for (const _ in obj) return false
    return true
}

export const isNotEmpty = (obj: Record<string, unknown> | DOMKeyframesDefinition | undefined) => {
    return !isEmpty(obj)
}
