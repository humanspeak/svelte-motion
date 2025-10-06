/**
 * SVG-specific properties that need special handling during animation.
 * These properties are not standard CSS properties and need to be transformed.
 */
export const SVG_PATH_PROPERTIES = new Set(['pathLength', 'pathOffset', 'pathSpacing'])

/**
 * Check if an element is an SVG path element.
 */
export function isSVGPathElement(element: Element): element is SVGPathElement {
    // Check if SVGPathElement is available (for SSR/test environments)
    if (typeof SVGPathElement === 'undefined') {
        return false
    }
    return element instanceof SVGPathElement
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

    const transformed = { ...keyframes }
    // let hasPathLength = false

    // Transform pathLength to strokeDasharray
    if ('pathLength' in transformed) {
        const pathLength = transformed.pathLength
        // hasPathLength = true

        // Normalize the path length by setting the pathLength attribute
        element.setAttribute('pathLength', '1')

        // Convert pathLength animation to strokeDasharray
        if (typeof pathLength === 'number') {
            // Single value: animate to this value
            transformed.strokeDasharray = `${pathLength} 1`
        } else if (Array.isArray(pathLength)) {
            // Array of values (keyframes)
            transformed.strokeDasharray = pathLength.map((value) =>
                typeof value === 'number' ? `${value} 1` : value
            )
        }

        delete transformed.pathLength
    }

    // Transform pathOffset to strokeDashoffset
    if ('pathOffset' in transformed) {
        const pathOffset = transformed.pathOffset
        // hasPathLength = true

        // pathOffset moves the dash pattern; negative value for forward drawing
        if (typeof pathOffset === 'number') {
            transformed.strokeDashoffset = -pathOffset
        } else if (Array.isArray(pathOffset)) {
            transformed.strokeDashoffset = pathOffset.map((value) =>
                typeof value === 'number' ? -value : value
            )
        }

        delete transformed.pathOffset
    }

    // Transform pathSpacing (space between dashes when pathLength < 1)
    if ('pathSpacing' in transformed) {
        // hasPathLength = true
        // pathSpacing is used in conjunction with pathLength
        // to create gaps in the stroke, but for now we'll just remove it
        // as it requires more complex dash array calculations
        delete transformed.pathSpacing
    }

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

    return transformSVGPathProperties(element, initial)
}
