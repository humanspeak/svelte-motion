import { camelCaseAttributes, camelToDash, isMotionValue, type MotionValue } from 'motion-dom'

/** SVG values Motion 13 renders through CSS instead of presentation attributes. */
export const SVG_CSS_STYLE_PROPERTIES = new Set([
    'transform',
    'opacity',
    'offsetDistance',
    'offsetPath',
    'offsetRotate',
    'offsetAnchor'
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
 * Determines whether a top-level SVG prop is eligible for MotionValue binding.
 * Upstream claims every prop whose current or previous value is a MotionValue;
 * `svgEffect` then selects the path, style, or attribute writer from the key.
 *
 * @param {string} key The prop name to test.
 * @returns {boolean} True when the prop is attribute-bindable.
 * @example
 * isSVGMotionValueAttribute('cx') // true
 * isSVGMotionValueAttribute('stdDeviation') // true — via camelCaseAttributes
 * isSVGMotionValueAttribute('attrScale') // true
 * isSVGMotionValueAttribute('pathLength') // true — svgEffect selects its path writer
 * isSVGMotionValueAttribute('custom') // true — custom SVG attributes are supported
 */
export const isSVGMotionValueAttribute = (key: string): boolean => {
    return key.length > 0
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
        if (SVG_CSS_STYLE_PROPERTIES.has(key)) continue
        // `MotionValue.get()` is `any`; narrow before stringifying.
        const current = value.get() as string | number | null | undefined
        if (current === null || current === undefined) continue
        attrs[toSVGDOMAttrName(key)] = String(current)
    }

    return attrs
}

/**
 * Resolves MotionValue-bound SVG props that upstream renders through CSS.
 *
 * @param motionValueAttrs MotionValue-bound SVG props.
 * @returns Current values for the SVG CSS style slot.
 */
export const computeSSRSVGStyleValues = (
    motionValueAttrs: Record<string, MotionValue>
): Record<string, string | number> => {
    const styles: Record<string, string | number> = {}

    for (const [key, value] of Object.entries(motionValueAttrs)) {
        if (!SVG_CSS_STYLE_PROPERTIES.has(key)) continue
        const current = value.get() as string | number | null | undefined
        if (current === null || current === undefined) continue
        styles[key] = current
    }

    return styles
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

    const len = initial.pathLength ?? 0
    const spa = initial.pathSpacing ?? 1
    const off = initial.pathOffset ?? 0

    const dashArray = `${toUnitless(len)} ${toUnitless(spa)}`
    const dashOffset = negate(off)

    // logging removed

    return {
        pathLength: '1',
        'stroke-dasharray': dashArray,
        'stroke-dashoffset': dashOffset
    }
}
