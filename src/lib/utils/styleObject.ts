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
    'column-count'
])

export function stringifyStyleObject(obj: Record<string, string | number>): string {
    return Object.entries(obj)
        .map(([key, value]) => {
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
            const isUnitless = UNITLESS_PROPERTIES.has(cssKey)
            const cssValue = typeof value === 'number' && !isUnitless ? `${value}px` : String(value)
            return `${cssKey}: ${cssValue}`
        })
        .join('; ')
}
