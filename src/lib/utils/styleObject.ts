// CSS properties that should not have 'px' appended when they are numbers
const UNITLESS_PROPERTIES = new Set([
    'opacity',
    'zIndex',
    'z-index',
    'fontWeight',
    'font-weight',
    'lineHeight',
    'line-height',
    'flex',
    'flexGrow',
    'flex-grow',
    'flexShrink',
    'flex-shrink',
    'order',
    'gridColumn',
    'grid-column',
    'gridRow',
    'grid-row',
    'columnCount',
    'column-count'
])

/**
 * Serialize a style object into a CSS declaration string.
 *
 * Property names are converted from camelCase to kebab-case. Numeric values are suffixed with `px`
 * unless the property (in either camelCase or kebab-case) is listed in `UNITLESS_PROPERTIES`.
 *
 * @param obj - A record of CSS properties (camelCase or kebab-case) to string or number values
 * @returns A `; `-separated CSS declaration string like `"font-size: 12px; line-height: 1.5"`
 */
export function stringifyStyleObject(obj: Record<string, string | number>): string {
    return Object.entries(obj)
        .map(([key, value]) => {
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
            const isUnitless = UNITLESS_PROPERTIES.has(key) || UNITLESS_PROPERTIES.has(cssKey)
            const cssValue = typeof value === 'number' && !isUnitless ? `${value}px` : String(value)
            return `${cssKey}: ${cssValue}`
        })
        .join('; ')
}