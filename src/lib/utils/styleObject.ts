// CSS properties that should not have 'px' appended when they are numbers
const UNITLESS_PROPERTIES = new Set([
    'opacity',
    'z-index',
    'font-weight',
    'line-height',
    'flex',
    'flex-grow',
    'flex-shrink',
    'order',
    'grid-column',
    'grid-row',
    'column-count',
    'scale',
    'scale-x',
    'scale-y',
    'scale-z'
])

// CSS properties that need 'deg' unit instead of 'px'
const DEGREE_PROPERTIES = new Set([
    'rotate',
    'rotate-x',
    'rotate-y',
    'rotate-z',
    'skew',
    'skew-x',
    'skew-y'
])

/**
 * Converts a style object to a CSS style string.
 *
 * @deprecated Use `styleString` from `@humanspeak/svelte-motion` instead for reactive styles.
 * This function is non-reactive and will not update when values change.
 *
 * @example
 * ```ts
 * // Old (deprecated, non-reactive):
 * import { stringifyStyleObject } from '$lib'
 * const style = stringifyStyleObject({ rotate: 45, opacity: 0.5 })
 *
 * // New (reactive):
 * import { styleString } from '@humanspeak/svelte-motion'
 * const style = styleString(() => ({ rotate, opacity }))
 * ```
 */
export function stringifyStyleObject(obj: Record<string, string | number>): string {
    return Object.entries(obj)
        .map(([key, value]) => {
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
            const isUnitless = UNITLESS_PROPERTIES.has(cssKey)
            const isDegree = DEGREE_PROPERTIES.has(cssKey)
            let cssValue: string
            if (typeof value === 'number') {
                if (isUnitless) {
                    cssValue = String(value)
                } else if (isDegree) {
                    cssValue = `${value}deg`
                } else {
                    cssValue = `${value}px`
                }
            } else {
                cssValue = String(value)
            }
            return `${cssKey}: ${cssValue}`
        })
        .join('; ')
}
