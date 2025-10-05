/**
 * Merge inline CSS styles from an existing style string with a Motion initial definition.
 * This is used during SSR to reflect the initial state in server-rendered markup.
 */
export const mergeInlineStyles = (
    existingStyle: unknown,
    initial: Record<string, unknown> | null | undefined,
    animateFallback?: Record<string, unknown> | null | undefined
): string => {
    const base: Record<string, string> = parseStyleString(
        typeof existingStyle === 'string' ? existingStyle : ''
    )

    const source = initial && Object.keys(initial).length > 0 ? initial : (animateFallback ?? null)
    if (!source) return stringifyStyleObject(base)

    // Collect transform parts so we can emit a single transform string
    const transformParts: string[] = []

    const setProp = (cssProp: string, value: unknown) => {
        if (value == null) return
        const v = Array.isArray(value) ? value[0] : value
        if (v == null) return
        base[cssProp] = String(v)
    }

    const setPx = (cssProp: string, value: unknown) => {
        if (value == null) return
        const v = Array.isArray(value) ? value[0] : value
        if (v == null) return
        base[cssProp] = typeof v === 'number' ? `${v}px` : String(v)
    }

    const addTransform = (fn: string, value: unknown, unit: string) => {
        if (value == null) return
        const v = Array.isArray(value) ? value[0] : value
        if (v == null) return
        const val = typeof v === 'number' ? `${v}${unit}` : String(v)
        transformParts.push(`${fn}(${val})`)
    }

    for (const key of Object.keys(source)) {
        const value = (source as Record<string, unknown>)[key]
        switch (key) {
            case 'opacity':
                setProp('opacity', value)
                break
            case 'backgroundColor':
                setProp('background-color', value)
                break
            case 'borderRadius':
                setProp('border-radius', value)
                break
            case 'width':
                setPx('width', value)
                break
            case 'height':
                setPx('height', value)
                break
            case 'x':
                addTransform('translateX', value, 'px')
                break
            case 'y':
                addTransform('translateY', value, 'px')
                break
            case 'z':
                addTransform('translateZ', value, 'px')
                break
            case 'scale':
                // scale is unitless
                addTransform('scale', value, '')
                break
            case 'scaleX':
                addTransform('scaleX', value, '')
                break
            case 'scaleY':
                addTransform('scaleY', value, '')
                break
            case 'rotate':
                addTransform(
                    'rotate',
                    value,
                    typeof (Array.isArray(value) ? value[0] : value) === 'number' ? 'deg' : ''
                )
                break
            case 'rotateX':
                addTransform(
                    'rotateX',
                    value,
                    typeof (Array.isArray(value) ? value[0] : value) === 'number' ? 'deg' : ''
                )
                break
            case 'rotateY':
                addTransform(
                    'rotateY',
                    value,
                    typeof (Array.isArray(value) ? value[0] : value) === 'number' ? 'deg' : ''
                )
                break
            case 'rotateZ':
                addTransform(
                    'rotateZ',
                    value,
                    typeof (Array.isArray(value) ? value[0] : value) === 'number' ? 'deg' : ''
                )
                break
            case 'skew':
            case 'skewX':
            case 'skewY':
                addTransform(
                    key,
                    value,
                    typeof (Array.isArray(value) ? value[0] : value) === 'number' ? 'deg' : ''
                )
                break
            case 'pointerEvents':
                base['pointer-events'] = String(Array.isArray(value) ? value[0] : value)
                break
            case 'cursor':
                setProp('cursor', value)
                break
            default:
                // Fallback: write raw as-is for simple CSS props
                if (typeof value === 'string' || typeof value === 'number') {
                    base[toKebabCase(key)] = String(value)
                }
                break
        }
    }

    if (transformParts.length > 0) {
        base['transform'] = transformParts.join(' ')
    }

    return stringifyStyleObject(base)
}

const parseStyleString = (style: string): Record<string, string> => {
    const out: Record<string, string> = {}
    style
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((decl) => {
            const idx = decl.indexOf(':')
            if (idx === -1) return
            const prop = decl.slice(0, idx).trim()
            const value = decl.slice(idx + 1).trim()
            if (prop) out[prop] = value
        })
    return out
}

const stringifyStyleObject = (obj: Record<string, string>): string =>
    Object.entries(obj)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ')

const toKebabCase = (s: string): string => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
