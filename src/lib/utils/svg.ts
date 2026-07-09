import {
    buildSVGPath,
    camelCaseAttributes,
    camelToDash,
    isMotionValue,
    type MotionValue
} from 'motion-dom'

/**
 * SVG-specific properties that need special handling during animation.
 * These properties are not standard CSS properties and need to be transformed.
 */
export const SVG_PATH_PROPERTIES = new Set(['pathLength', 'pathOffset', 'pathSpacing'])

/**
 * SVG props that may be driven by a `MotionValue`.
 *
 * Mirrors the animatable surface of upstream's `buildSVGAttrs`
 * (`motion-dom/src/render/svg/utils/build-attrs.ts`). Upstream is React-facing
 * and only lists JSX camelCase spellings, so the hyphenated keys appear here in
 * *both* forms: a Svelte template takes the DOM spelling, and a user writing
 * `<motion.circle stroke-width={mv}>` must have that prop claimed out of the raw
 * attribute spread or it renders `stroke-width="[object Object]"`.
 *
 * Membership means only "pull this out of the raw spread". It does **not** mean
 * "this is a DOM attribute": `svgEffect` decides that per key at runtime via
 * `key in element.style ? addStyleValue : addAttrValue`
 * (`motion-dom/src/effects/svg/index.ts`). In Chromium `cx`, `r`, `width` and the
 * `stroke-*` family are CSS properties and route to `element.style`, while
 * `points`, `viewBox` and `x1`/`y1`/`x2`/`y2` route to `setAttribute`.
 *
 * Path props are deliberately excluded — the path pipeline owns them.
 */
export const SVG_ATTRIBUTE_PROPERTIES = new Set([
    // Geometry
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'x',
    'y',
    'x1',
    'y1',
    'x2',
    'y2',
    'width',
    'height',
    'points',
    'd',
    'offset',
    'viewBox',
    // Presentation (React/JSX camelCase spellings)
    'stopColor',
    'stopOpacity',
    'fillOpacity',
    'strokeOpacity',
    'strokeWidth',
    'strokeDashoffset',
    'strokeDasharray',
    // Presentation (DOM kebab spellings, as written in a Svelte template)
    'stop-color',
    'stop-opacity',
    'fill-opacity',
    'stroke-opacity',
    'stroke-width',
    'stroke-dashoffset',
    'stroke-dasharray'
])

/**
 * Strips the `attr` prefix from `attrX`/`attrY`/`attrScale`, yielding the SVG
 * attribute name upstream renders them as (`x`/`y`/`scale`).
 *
 * Mirrors upstream's `/^attr([A-Z])/` conversion in
 * `motion-dom/src/effects/svg/index.ts`, and the `attrX -> attrs.x` destructuring
 * in `build-attrs.ts:23-25,82-85`.
 *
 * Apply this to **static** props and to SSR output only. MotionValue-bound props
 * must reach `svgEffect` un-renamed, because it performs this conversion itself;
 * pre-renaming `attrScale` to `scale` would instead make it match the
 * `key in element.style` branch and become a CSS style.
 *
 * @param {string} key The incoming prop name.
 * @returns {string} The resolved SVG attribute name.
 * @example
 * resolveSVGAttrKey('attrX') // 'x'
 * resolveSVGAttrKey('attribute') // 'attribute' — prefix needs an uppercase char
 */
export const resolveSVGAttrKey = (key: string): string => {
    return key.replace(/^attr([A-Z])/, (_, firstChar: string) => firstChar.toLowerCase())
}

/**
 * Determines whether a prop may be bound to a `MotionValue` on an SVG element.
 *
 * Path props return false: they are owned by the path-drawing pipeline, and
 * claiming them here would double-write `stroke-dasharray`.
 *
 * @param {string} key The prop name to test.
 * @returns {boolean} True when the prop is attribute-bindable.
 * @example
 * isSVGMotionValueAttribute('cx') // true
 * isSVGMotionValueAttribute('attrScale') // true
 * isSVGMotionValueAttribute('pathLength') // false
 */
export const isSVGMotionValueAttribute = (key: string): boolean => {
    if (SVG_PATH_PROPERTIES.has(key)) return false
    if (/^attr[A-Z]/.test(key)) return true
    return SVG_ATTRIBUTE_PROPERTIES.has(key)
}

/**
 * Splits an SVG element's leftover props into MotionValue-bound attributes and
 * plain static attributes.
 *
 * MotionValue keys are returned **verbatim** so `svgEffect` can apply its own
 * `attr`-prefix conversion and style-vs-attribute routing. Static attr-prefixed
 * props are renamed eagerly, matching upstream's `buildSVGAttrs`.
 *
 * @param {Record<string, unknown>} rest The element's unclaimed props.
 * @returns {{motionValueAttrs: Record<string, MotionValue>, staticAttrs: Record<string, unknown>}}
 *   The MotionValue-bound attrs to subscribe, and the static attrs to spread.
 * @example
 * const { motionValueAttrs, staticAttrs } = extractSVGMotionValueAttributes({
 *   cx: motionValue(10),
 *   attrX: 4
 * })
 * // motionValueAttrs -> { cx: MotionValue }   (un-renamed, for svgEffect)
 * // staticAttrs      -> { x: 4 }              (renamed, for the spread)
 */
export const extractSVGMotionValueAttributes = (
    rest: Record<string, unknown>
): {
    motionValueAttrs: Record<string, MotionValue>
    staticAttrs: Record<string, unknown>
} => {
    const motionValueAttrs: Record<string, MotionValue> = {}
    const staticAttrs: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(rest)) {
        if (isMotionValue(value) && isSVGMotionValueAttribute(key)) {
            motionValueAttrs[key] = value
        } else if (!isMotionValue(value) && /^attr[A-Z]/.test(key)) {
            staticAttrs[resolveSVGAttrKey(key)] = value
        } else {
            staticAttrs[key] = value
        }
    }

    return { motionValueAttrs, staticAttrs }
}

/**
 * Converts a MotionValue-bound prop name into the DOM attribute name to emit
 * during SSR.
 *
 * The `attr` prefix is stripped **before** the casing gate is applied. `attrX` is
 * not a member of `camelCaseAttributes`, so gating first would dash-case it into
 * the inert `attr-x`. Upstream imposes the same ordering: `buildSVGAttrs`
 * destructures `attrX` into `attrs.x` before `renderSVG`
 * (`motion-dom/src/render/svg/utils/render.ts:15-19`) applies
 * `!camelCaseAttributes.has(key) ? camelToDash(key) : key`.
 *
 * @param {string} key The incoming prop name.
 * @returns {string} The DOM attribute name.
 */
const toSVGDOMAttrName = (key: string): string => {
    const resolved = resolveSVGAttrKey(key)
    return camelCaseAttributes.has(resolved) ? resolved : camelToDash(resolved)
}

/**
 * Resolves MotionValue-bound SVG attributes to their current values for server
 * rendering, keyed by DOM attribute name.
 *
 * SSR must emit the MotionValue's current value so the server payload is correct
 * and hydration doesn't flash. SVG attribute names are case-sensitive, so the
 * emitted names go through upstream's casing gate: `strokeDashoffset` becomes
 * `stroke-dashoffset`, while `viewBox` and the filter primitives stay camelCase.
 *
 * Style-routed keys (`cx`, `r`, …) SSR correctly as presentation attributes; the
 * client-set CSS property simply wins once `svgEffect` subscribes.
 *
 * @param {Record<string, MotionValue>} motionValueAttrs MotionValue-bound attrs.
 * @returns {Record<string, string>} DOM attribute names mapped to string values.
 * @example
 * computeSSRSVGAttrValues({ attrX: motionValue(3) }) // { x: '3' }
 * computeSSRSVGAttrValues({ strokeDashoffset: motionValue(4) }) // { 'stroke-dashoffset': '4' }
 */
export const computeSSRSVGAttrValues = (
    motionValueAttrs: Record<string, MotionValue>
): Record<string, string> => {
    const attrs: Record<string, string> = {}

    for (const [key, value] of Object.entries(motionValueAttrs)) {
        const current = value.get()
        if (current === null || current === undefined) continue
        attrs[toSVGDOMAttrName(key)] = String(current)
    }

    return attrs
}

/**
 * The SVG namespace URI.
 */
export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/**
 * Set of SVG tag names that should be created in the SVG namespace.
 * This list covers all standard SVG elements.
 */
export const SVG_TAGS = new Set([
    'svg',
    'animate',
    'animatemotion',
    'animatetransform',
    'circle',
    'clippath',
    'defs',
    'desc',
    'ellipse',
    'feblend',
    'fecolormatrix',
    'fecomponenttransfer',
    'fecomposite',
    'feconvolvematrix',
    'fediffuselighting',
    'fedisplacementmap',
    'fedistantlight',
    'fedropshadow',
    'feflood',
    'fefunca',
    'fefuncb',
    'fefuncg',
    'fefuncr',
    'fegaussianblur',
    'feimage',
    'femerge',
    'femergenode',
    'femorphology',
    'feoffset',
    'fepointlight',
    'fespecularlighting',
    'fespotlight',
    'fetile',
    'feturbulence',
    'filter',
    'foreignobject',
    'g',
    'image',
    'line',
    'lineargradient',
    'marker',
    'mask',
    'metadata',
    'mpath',
    'path',
    'pattern',
    'polygon',
    'polyline',
    'radialgradient',
    'rect',
    'set',
    'stop',
    'switch',
    'symbol',
    'text',
    'textpath',
    'title',
    'tref',
    'tspan',
    'use',
    'view'
])

/**
 * Determines whether the provided tag name is an SVG element tag.
 *
 * @param {string} tag The tag name to test.
 * @returns {boolean} True when the tag is an SVG element.
 * @example
 * isSVGTag('path') // true
 * isSVGTag('div') // false
 */
export const isSVGTag = (tag: string): boolean => {
    return SVG_TAGS.has(tag.toLowerCase())
}

/**
 * Canonical casing for the SVG elements whose tag names are not all-lowercase.
 *
 * SVG tag names are **case-sensitive**, unlike HTML. Creating
 * `fedisplacementmap` in the SVG namespace yields an inert generic `SVGElement`
 * rather than an `SVGFEDisplacementMapElement`, so the filter primitive is
 * ignored and its attributes (`scale`, `stdDeviation`, …) do nothing.
 *
 * Keys are the lowercase forms our components pass as `tag`; values are the
 * spec spellings. See the SVG 2 element index.
 */
export const SVG_TAG_CASING: Record<string, string> = {
    animatemotion: 'animateMotion',
    animatetransform: 'animateTransform',
    clippath: 'clipPath',
    feblend: 'feBlend',
    fecolormatrix: 'feColorMatrix',
    fecomponenttransfer: 'feComponentTransfer',
    fecomposite: 'feComposite',
    feconvolvematrix: 'feConvolveMatrix',
    fediffuselighting: 'feDiffuseLighting',
    fedisplacementmap: 'feDisplacementMap',
    fedistantlight: 'feDistantLight',
    fedropshadow: 'feDropShadow',
    feflood: 'feFlood',
    fefunca: 'feFuncA',
    fefuncb: 'feFuncB',
    fefuncg: 'feFuncG',
    fefuncr: 'feFuncR',
    fegaussianblur: 'feGaussianBlur',
    feimage: 'feImage',
    femerge: 'feMerge',
    femergenode: 'feMergeNode',
    femorphology: 'feMorphology',
    feoffset: 'feOffset',
    fepointlight: 'fePointLight',
    fespecularlighting: 'feSpecularLighting',
    fespotlight: 'feSpotLight',
    fetile: 'feTile',
    feturbulence: 'feTurbulence',
    foreignobject: 'foreignObject',
    lineargradient: 'linearGradient',
    radialgradient: 'radialGradient',
    textpath: 'textPath'
}

/**
 * Resolves an SVG tag name to its case-sensitive spec spelling.
 *
 * Non-SVG tags and already-correct names are returned unchanged.
 *
 * @param {string} tag The tag name to canonicalize.
 * @returns {string} The spec-cased SVG tag name.
 * @example
 * resolveSVGTagName('fedisplacementmap') // 'feDisplacementMap'
 * resolveSVGTagName('circle') // 'circle'
 * resolveSVGTagName('div') // 'div'
 */
export const resolveSVGTagName = (tag: string): string => {
    return SVG_TAG_CASING[tag.toLowerCase()] ?? tag
}

/**
 * Check if an element is an SVG path element.
 */
/**
 * Determines whether the provided element is an SVGPathElement.
 *
 * @param {Element} element The candidate element to test.
 * @returns {element is SVGPathElement} True when the element is an SVG path.
 * @example
 * const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
 * if (isSVGPathElement(el)) {
 *   // el is now typed as SVGPathElement
 * }
 */
export const isSVGPathElement = (element: Element): element is SVGPathElement => {
    if (typeof SVGPathElement !== 'undefined') {
        return element instanceof SVGPathElement
    }
    const nsOk = element.namespaceURI === 'http://www.w3.org/2000/svg'
    const tagOk = (element as { tagName?: string }).tagName?.toLowerCase() === 'path'
    return !!(nsOk && tagOk)
}

/**
 * Check if an element is any SVG element.
 */
/**
 * Determines whether the provided element is an SVGElement.
 *
 * @param {Element} element The candidate element to test.
 * @returns {element is SVGElement} True when the element is an SVG element.
 * @example
 * const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
 * if (isSVGElement(svg)) {
 *   // svg is now typed as SVGElement
 * }
 */
export const isSVGElement = (element: Element): element is SVGElement => {
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
/**
 * Transforms SVG path-specific animation properties into DOM-compatible attributes.
 *
 * Normalized behavior (React/Framer Motion parity):
 * - Ensures `pathLength="1"` is set when any path prop is present
 * - Maps `pathLength`/`pathSpacing` → unitless `stroke-dasharray`
 * - Maps `pathOffset` → unitless negative `stroke-dashoffset`
 *
 * @param {Element} element The element being animated (must be an SVG path).
 * @param {Record<string, unknown>} keyframes The input keyframes possibly containing path props.
 * @returns {Record<string, unknown>} A transformed keyframe object safe for animation.
 */
export const transformSVGPathProperties = (
    element: Element,
    keyframes: Record<string, unknown>
): Record<string, unknown> => {
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

        const toUnitless = (v: unknown): string => (typeof v === 'number' ? `${v}` : String(v))

        const buildDashArray = (len: unknown, spa: unknown): string =>
            `${toUnitless(len)} ${toUnitless(spa)}`

        // stroke-dasharray from pathLength/pathSpacing with upstream's default spacing = 1
        if (Array.isArray(length)) {
            const lenArr = length as unknown[]
            const spaArr = Array.isArray(spacing)
                ? (spacing as unknown[])
                : lenArr.map(() => (spacing !== undefined ? (spacing as unknown) : 1))
            const dashArray = lenArr.map((lv, i) => buildDashArray(lv, spaArr[i]))
            ;(transformed as Record<string, unknown>).strokeDasharray = dashArray
            ;(transformed as Record<string, unknown>)['stroke-dasharray'] = dashArray
        } else if (length !== undefined) {
            const lenNum = toNum(length)
            const spaNum = spacing === undefined ? undefined : toNum(spacing)
            const offsetNum = offset === undefined ? undefined : toNum(offset)
            let dashArray: string
            let dashOffset: string | undefined

            if (
                lenNum !== undefined &&
                (spacing === undefined || spaNum !== undefined) &&
                (offset === undefined || offsetNum !== undefined)
            ) {
                const attrs: Record<string, string | number> = {}
                buildSVGPath(attrs, lenNum, spacing === undefined ? 1 : spaNum, offsetNum, true)
                dashArray = String(attrs['stroke-dasharray'])
                dashOffset = String(attrs['stroke-dashoffset'])
            } else {
                const spa = spacing !== undefined ? spacing : 1
                dashArray = buildDashArray(length, spa)
            }

            ;(transformed as Record<string, unknown>).strokeDasharray = dashArray
            ;(transformed as Record<string, unknown>)['stroke-dasharray'] = dashArray
            if (dashOffset !== undefined) {
                ;(transformed as Record<string, unknown>).strokeDashoffset = dashOffset
                ;(transformed as Record<string, unknown>)['stroke-dashoffset'] = dashOffset
            }
        }

        // stroke-dashoffset from -pathOffset
        if (Array.isArray(offset)) {
            const offs = (offset as unknown[]).map((ov) => {
                const n = toNum(ov)
                return n !== undefined ? `${-n}` : String(ov)
            })
            ;(transformed as Record<string, unknown>).strokeDashoffset = offs
            ;(transformed as Record<string, unknown>)['stroke-dashoffset'] = offs
        } else if (offset !== undefined) {
            const n = toNum(offset)
            const off = n !== undefined ? `${-n}` : String(offset)
            ;(transformed as Record<string, unknown>).strokeDashoffset = off
            ;(transformed as Record<string, unknown>)['stroke-dashoffset'] = off
        } else if (!('stroke-dashoffset' in transformed)) {
            // default 0
            ;(transformed as Record<string, unknown>).strokeDashoffset = '0'
            ;(transformed as Record<string, unknown>)['stroke-dashoffset'] = '0'
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
/**
 * Checks if any SVG path-related properties are present in the keyframes object.
 *
 * @param {Record<string, unknown>} keyframes The keyframes to inspect.
 * @returns {boolean} True if any of `pathLength`, `pathSpacing`, or `pathOffset` are present.
 */
export const hasSVGPathProperties = (keyframes: Record<string, unknown>): boolean => {
    return Object.keys(keyframes).some((key) => SVG_PATH_PROPERTIES.has(key))
}

/**
 * Transform initial SVG path properties for initial state setup.
 * This ensures that the initial state also has the proper strokeDasharray values.
 */
/**
 * Transforms initial keyframes for SVG paths so that the initial state uses
 * normalized dash attributes.
 *
 * @param {Element} element The element being animated (must be an SVG path).
 * @param {Record<string, unknown> | undefined} initial Initial keyframes, if provided.
 * @returns {Record<string, unknown> | undefined} Transformed initial keyframes or the original value.
 */
export const transformInitialSVGPathProperties = (
    element: Element,
    initial: Record<string, unknown> | undefined
): Record<string, unknown> | undefined => {
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
 * - stroke-dasharray = pathLength + ' ' + (pathSpacing ?? 1)
 * - stroke-dashoffset = -(pathOffset ?? 0)
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

    const toUnitless = (v: unknown): string => (typeof v === 'number' ? `${v}` : String(v))
    const negate = (v: unknown): string => {
        if (typeof v === 'number') return `${-v}`
        const s = String(v)
        return s.startsWith('-') ? s : /^[\d.]+(px)?$/i.test(s) ? `-${s.replace(/px$/i, '')}` : s
    }

    const len = (initial as Record<string, unknown>).pathLength ?? 0
    const spa = (initial as Record<string, unknown>).pathSpacing ?? 1
    const off = (initial as Record<string, unknown>).pathOffset ?? 0

    const dashArray = `${toUnitless(len)} ${toUnitless(spa)}`
    const dashOffset = negate(off)

    // logging removed

    return {
        pathLength: '1',
        'stroke-dasharray': dashArray,
        'stroke-dashoffset': dashOffset
    }
}
