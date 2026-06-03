import { isMotionValue, type MotionValue } from 'motion-dom'

/**
 * Structural MotionValue shape accepted by object-form styles.
 *
 * The public API intentionally stays structural because Svelte Motion wraps
 * and augments MotionValues while preserving Motion's runtime contract.
 */
export type MotionStyleMotionValue = {
    /** Read the current style value. */
    get: () => string | number
}

/**
 * A value accepted inside Motion's object-form `style` prop.
 *
 * Static values are serialized into the rendered inline style. MotionValues
 * are also serialized with their current value, then subscribed with
 * `motion-dom`'s `styleEffect` so they can update the DOM without rerenders.
 */
export type MotionStyleValue = string | number | MotionStyleMotionValue | null | undefined

/**
 * React-style object form for the `style` prop.
 *
 * Supports normal CSS properties, CSS variables, and Motion transform
 * shortcuts like `x`, `y`, `scale`, and `rotate`.
 */
export type MotionStyle = Record<string, MotionStyleValue>

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
            // Skip SVG path animation properties - they'll be set by animate()
            case 'pathLength':
            case 'pathOffset':
            case 'pathSpacing':
            case 'strokeDasharray':
            case 'stroke-dasharray':
            case 'strokeDashoffset':
            case 'stroke-dashoffset':
                // Don't add these to inline styles - they interfere with animation
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

/**
 * Extract the user-authored `transform` declaration from a `style` prop.
 *
 * Used by the projection system as the "base" transform a node resets to
 * while measuring — the value the user wrote, independent of any
 * motion-applied transform (`initial`/`animate`/FLIP/drag) that lands on
 * `element.style.transform` after mount. Reading it from the `style` prop
 * rather than the live inline style is what keeps an `initial={{ x }}` (or
 * any transform-type initial/animate) from being mistaken for the base.
 *
 * Returns `''` when the prop is not a string or carries no transform.
 *
 * @param style The component's `style` prop.
 * @returns The user's `transform` value, or `''`.
 * @example
 * ```ts
 * extractTransform('opacity: 0.5; transform: translateX(10px) scale(2)')
 * // => 'translateX(10px) scale(2)'
 * extractTransform('color: red') // => ''
 * extractTransform({ color: 'red' }) // => '' (non-string)
 * ```
 */
export const extractTransform = (style: unknown): string => {
    if (typeof style !== 'string') {
        if (!isMotionStyleObject(style)) return ''
        const transform = resolveStyleValue(style.transform)
        return transform == null ? '' : String(transform)
    }
    return parseStyleString(style).transform ?? ''
}

/**
 * Serialize a string or object-form Motion style prop into inline CSS.
 *
 * @param style The consumer-provided style prop.
 * @returns Inline CSS suitable for Svelte's `style` attribute.
 */
export const serializeMotionStyle = (style: string | MotionStyle | null | undefined): string => {
    if (typeof style === 'string') return style
    if (!isMotionStyleObject(style)) return ''
    return mergeInlineStyles('', resolveMotionStyle(style), null)
}

/**
 * Collect MotionValue entries from object-form style props.
 *
 * @param style The consumer-provided style prop.
 * @returns A map of style keys to MotionValues, or `undefined` when no live
 *   style values are present.
 */
export const collectMotionStyleValues = (
    style: unknown
): Record<string, MotionValue> | undefined => {
    if (!isMotionStyleObject(style)) return undefined

    const values: Record<string, MotionValue> = {}
    for (const [key, value] of Object.entries(style)) {
        if (isMotionValue(value)) {
            values[key] = value as MotionValue
        }
    }

    return Object.keys(values).length ? values : undefined
}

const isMotionStyleObject = (style: unknown): style is MotionStyle =>
    !!style && typeof style === 'object' && !Array.isArray(style)

const resolveMotionStyle = (style: MotionStyle): Record<string, unknown> => {
    const resolved: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(style)) {
        resolved[key] = resolveStyleValue(value)
    }

    return resolved
}

const resolveStyleValue = (value: MotionStyleValue): string | number | null | undefined => {
    if (isMotionStyleMotionValue(value)) return value.get()
    return value
}

const isMotionStyleMotionValue = (value: MotionStyleValue): value is MotionStyleMotionValue =>
    !!value && typeof value === 'object' && 'get' in value && typeof value.get === 'function'

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
