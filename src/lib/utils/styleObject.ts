export function stringifyStyleObject(obj: Record<string, string | number>): string {
    return Object.entries(obj)
        .map(([key, value]) => {
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
            const cssValue = typeof value === 'number' ? `${value}px` : value
            return `${cssKey}: ${cssValue}`
        })
        .join('; ')
}
