/**
 * SVG-specific properties that need special handling during animation.
 * These properties are not standard CSS properties and need to be transformed.
 */
export const SVG_PATH_PROPERTIES = new Set(['pathLength', 'pathOffset', 'pathSpacing'])

/**
 * Check if an element is an SVG path element.
 */
export function isSVGPathElement(element: Element): element is SVGPathElement {
    // In browsers, prefer native instanceof check
    if (typeof SVGPathElement !== 'undefined') {
        return element instanceof SVGPathElement
    }
    // Fallback for SSR/JSDOM environments: detect by namespace and tag name
    const nsOk = element.namespaceURI === 'http://www.w3.org/2000/svg'
    const tagOk = (element as { tagName?: string }).tagName?.toLowerCase() === 'path'
    return !!(nsOk && tagOk)
}

/**
 * Check if an element is any SVG element.
 */
export function isSVGElement(element: Element): element is SVGElement {
    // Check if SVGElement is available (for SSR/test environments)
    if (typeof SVGElement === 'undefined') {
        return false
    }
    return element instanceof SVGElement
}

/**
 * Transform SVG path-specific animation properties to their CSS equivalents.
 *
 * Motion's pathLength property creates a line-drawing effect by manipulating
 * strokeDasharray and strokeDashoffset. This function transforms:
 * - pathLength: 0 -> 1 becomes strokeDasharray: "0 1" -> "1 1"
 * - pathOffset: value becomes strokeDashoffset: -value (inverted for drawing direction)
 *
 * @param element - The SVG element being animated
 * @param keyframes - The animation keyframes that may contain SVG properties
 * @returns Transformed keyframes with CSS-compatible properties
 */
export function transformSVGPathProperties(
    element: Element,
    keyframes: Record<string, unknown>
): Record<string, unknown> {
    if (!isSVGPathElement(element)) {
        return keyframes
    }

    // logging removed

    const transformed = { ...keyframes }
    // let hasPathLength = false

    // Transform normalized path props to dash attributes using pathLength="1" semantics
    if (
        'pathLength' in transformed ||
        'pathSpacing' in transformed ||
        'pathOffset' in transformed
    ) {
        try {
            element.setAttribute('pathLength', '1')
        } catch {
            void 0
        }

        const toNum = (v: unknown): number | undefined =>
            typeof v === 'number'
                ? v
                : v != null && /^-?\d+(\.\d+)?(px)?$/i.test(String(v).trim())
                  ? parseFloat(String(v))
                  : undefined
        const length = ((): unknown => {
            const v = (transformed as Record<string, unknown>).pathLength
            const n = toNum(v)
            return n ?? v
        })()
        const spacing = ((): unknown => {
            const v = (transformed as Record<string, unknown>).pathSpacing
            const n = toNum(v)
            return n ?? v
        })()
        const offset = ((): unknown => {
            const v = (transformed as Record<string, unknown>).pathOffset
            const n = toNum(v)
            return n ?? v
        })()

        const toPx = (v: unknown): string => (typeof v === 'number' ? `${v}px` : String(v))

        const buildDashArray = (len: unknown, spa: unknown): string => `${toPx(len)} ${toPx(spa)}`

        // stroke-dasharray from pathLength/pathSpacing with default spacing = 1 - length
        if (Array.isArray(length)) {
            const lenArr = length as unknown[]
            const spaArr = Array.isArray(spacing)
                ? (spacing as unknown[])
                : lenArr.map((lv) =>
                      typeof lv === 'number' ? 1 - (lv as number) : (spacing as unknown)
                  )
            const dashArray = lenArr.map((lv, i) => buildDashArray(lv, spaArr[i]))
            ;(transformed as Record<string, unknown>).strokeDasharray = dashArray
            ;(transformed as Record<string, unknown>)['stroke-dasharray'] = dashArray
        } else if (length !== undefined) {
            const len = length
            const lenNum = toNum(len) ?? 0
            const spa = spacing !== undefined ? spacing : 1 - lenNum
            const dashArray = buildDashArray(len, spa)
            ;(transformed as Record<string, unknown>).strokeDasharray = dashArray
            ;(transformed as Record<string, unknown>)['stroke-dasharray'] = dashArray
        }

        // stroke-dashoffset from -pathOffset
        if (Array.isArray(offset)) {
            const offs = (offset as unknown[]).map((ov) => {
                const n = toNum(ov)
                return n !== undefined ? `${-n}px` : String(ov)
            })
            ;(transformed as Record<string, unknown>).strokeDashoffset = offs
            ;(transformed as Record<string, unknown>)['stroke-dashoffset'] = offs
        } else if (offset !== undefined) {
            const n = toNum(offset)
            const off = n !== undefined ? `${-n}px` : String(offset)
            ;(transformed as Record<string, unknown>).strokeDashoffset = off
            ;(transformed as Record<string, unknown>)['stroke-dashoffset'] = off
        } else {
            // default 0
            ;(transformed as Record<string, unknown>).strokeDashoffset = '0px'
            ;(transformed as Record<string, unknown>)['stroke-dashoffset'] = '0px'
        }

        delete (transformed as Record<string, unknown>).pathLength
        delete (transformed as Record<string, unknown>).pathSpacing
        delete (transformed as Record<string, unknown>).pathOffset
    }

    // logging removed

    return transformed
}

/**
 * Check if any keyframes contain SVG path properties.
 */
export function hasSVGPathProperties(keyframes: Record<string, unknown>): boolean {
    return Object.keys(keyframes).some((key) => SVG_PATH_PROPERTIES.has(key))
}

/**
 * Transform initial SVG path properties for initial state setup.
 * This ensures that the initial state also has the proper strokeDasharray values.
 */
export function transformInitialSVGPathProperties(
    element: Element,
    initial: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
    if (!initial || !isSVGPathElement(element)) {
        return initial
    }
    // logging removed
    return transformSVGPathProperties(element, initial)
}

/**
 * Computes normalized SVG path attributes for initial render without requiring an element.
 *
 * Behavior matches React/Framer Motion parity:
 * - Always sets pathLength="1" whenever any of path props are present
 * - stroke-dasharray = px(pathLength) + ' ' + px(pathSpacing ?? 1 - Number(pathLength))
 * - stroke-dashoffset = px(-(pathOffset ?? 0))
 *
 * The returned object is suitable for direct DOM attribute assignment (dash-cased keys).
 *
 * @param {Record<string, unknown> | null | undefined} initial Incoming initial keyframes object
 * @returns {Record<string, string> | null} Normalized attribute map or null if no path props
 */
export const computeNormalizedSVGInitialAttrs = (
    initial: Record<string, unknown> | null | undefined
): Record<string, string> | null => {
    if (!initial) return null
    const hasAny = 'pathLength' in initial || 'pathSpacing' in initial || 'pathOffset' in initial
    if (!hasAny) return null

    const toPx = (v: unknown): string => (typeof v === 'number' ? `${v}px` : String(v))
    const negatePx = (v: unknown): string => {
        if (typeof v === 'number') return `${-v}px`
        const s = String(v)
        return s.startsWith('-') ? s : /^[\d.]+(px)?$/i.test(s) ? `-${s}` : s
    }

    const len = (initial as Record<string, unknown>).pathLength ?? 0
    const spa =
        (initial as Record<string, unknown>).pathSpacing ??
        (typeof len === 'number' ? 1 - (len as number) : 1)
    const off = (initial as Record<string, unknown>).pathOffset ?? 0

    const dashArray = `${toPx(len)} ${toPx(spa)}`
    const dashOffset = negatePx(off)

    // logging removed

    return {
        pathLength: '1',
        'stroke-dasharray': dashArray,
        'stroke-dashoffset': dashOffset
    }
}
