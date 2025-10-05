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
