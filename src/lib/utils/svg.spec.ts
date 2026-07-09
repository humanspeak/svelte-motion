/**
 * @vitest-environment jsdom
 */
import { camelCaseAttributes, camelToDash, motionValue } from 'motion-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    computeNormalizedSVGInitialAttrs,
    computeSSRSVGAttrValues,
    extractSVGMotionValueAttributes,
    hasSVGPathProperties,
    isSVGMotionValueAttribute,
    isSVGPathElement,
    resolveSVGAttrKey,
    SVG_ATTRIBUTE_PROPERTIES,
    SVG_PATH_PROPERTIES,
    transformInitialSVGPathProperties,
    transformSVGPathProperties
} from './svg'

describe('svg utilities', () => {
    let mockPathElement: SVGPathElement

    beforeAll(() => {
        // Ensure SVG constructors are available in the test environment
        if (typeof SVGPathElement === 'undefined') {
            // Skip tests if SVG is not available
            console.warn('SVG elements not available in test environment')
        }
    })

    beforeEach(() => {
        // Create a real SVGPathElement
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        mockPathElement = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'path'
        ) as SVGPathElement
        svg.appendChild(mockPathElement)
        document.body.appendChild(svg)

        vi.spyOn(mockPathElement, 'setAttribute')
    })

    describe('isSVGPathElement', () => {
        it('should return true for SVG path elements', () => {
            expect(isSVGPathElement(mockPathElement)).toBe(true)
        })

        it('should return false for non-SVG elements', () => {
            const div = document.createElement('div')
            expect(isSVGPathElement(div)).toBe(false)
        })

        it('should return false for other SVG elements', () => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
            expect(isSVGPathElement(circle)).toBe(false)
        })
    })

    describe('hasSVGPathProperties', () => {
        it('should return true if pathLength is present', () => {
            expect(hasSVGPathProperties({ pathLength: 1 })).toBe(true)
        })

        it('should return true if pathOffset is present', () => {
            expect(hasSVGPathProperties({ pathOffset: 0.5 })).toBe(true)
        })

        it('should return true if pathSpacing is present', () => {
            expect(hasSVGPathProperties({ pathSpacing: 2 })).toBe(true)
        })

        it('should return false for regular properties', () => {
            expect(hasSVGPathProperties({ opacity: 1, x: 100 })).toBe(false)
        })
    })

    describe('transformSVGPathProperties', () => {
        it('should transform pathLength to normalized unitless dash attributes and set pathLength="1"', () => {
            const keyframes = { pathLength: 1 }
            const result = transformSVGPathProperties(mockPathElement, keyframes)

            expect(result).not.toHaveProperty('pathLength')
            expect(result).toHaveProperty('stroke-dasharray', '1 1')
            expect(result).toHaveProperty('stroke-dashoffset', '0')
            expect(mockPathElement.setAttribute).toHaveBeenCalledWith('pathLength', '1')
        })

        it('should transform pathLength array to normalized unitless dasharray array', () => {
            const keyframes = { pathLength: [0, 0.5, 1] }
            const result = transformSVGPathProperties(mockPathElement, keyframes)

            expect(result).toHaveProperty('stroke-dasharray', ['0 1', '0.5 1', '1 1'])
            expect(result).not.toHaveProperty('pathLength')
        })

        it('should transform pathOffset to negative unitless strokeDashoffset', () => {
            const keyframes = { pathOffset: 0.5 }
            const result = transformSVGPathProperties(mockPathElement, keyframes)

            expect(result).toHaveProperty('stroke-dashoffset', '-0.5')
            expect(result).not.toHaveProperty('pathOffset')
        })

        it('should transform pathOffset array to negative unitless strokeDashoffset array', () => {
            const keyframes = { pathOffset: [0, 0.5, 1] }
            const result = transformSVGPathProperties(mockPathElement, keyframes)

            expect(result).toHaveProperty('stroke-dashoffset', ['0', '-0.5', '-1'])
        })

        it('should handle both pathLength and pathOffset together (normalized unitless, pathLength="1")', () => {
            const keyframes = { pathLength: 1, pathOffset: 0.5 }
            const result = transformSVGPathProperties(mockPathElement, keyframes)

            expect(result).toHaveProperty('stroke-dasharray', '1 1')
            expect(result).toHaveProperty('stroke-dashoffset', '-0.5')
            expect(mockPathElement.setAttribute).toHaveBeenCalledWith('pathLength', '1')
        })

        it('should preserve other properties', () => {
            const keyframes = { pathLength: 1, opacity: 0.5, x: 100 }
            const result = transformSVGPathProperties(mockPathElement, keyframes)

            expect(result).toMatchObject({
                'stroke-dasharray': '1 1',
                'stroke-dashoffset': '0',
                opacity: 0.5,
                x: 100
            })
        })

        it('should not transform if element is not an SVG path', () => {
            const div = document.createElement('div')
            const keyframes = { pathLength: 1 }
            const result = transformSVGPathProperties(div, keyframes)

            expect(result).toEqual(keyframes)
        })

        it('should handle pathSpacing by transforming to normalized unitless dasharray and removing pathSpacing', () => {
            const keyframes = { pathLength: 1, pathSpacing: 0.5 }
            const result = transformSVGPathProperties(mockPathElement, keyframes)

            expect(result).not.toHaveProperty('pathSpacing')
            expect(result).toHaveProperty('stroke-dasharray', '1 0.5')
        })
    })

    describe('transformInitialSVGPathProperties', () => {
        it('should transform initial properties (normalized unitless)', () => {
            const initial = { pathLength: 0, opacity: 1 }
            const result = transformInitialSVGPathProperties(mockPathElement, initial)

            expect(result).toMatchObject({
                'stroke-dasharray': '0 1',
                'stroke-dashoffset': '0',
                opacity: 1
            })
        })

        it('should return undefined if initial is undefined', () => {
            const result = transformInitialSVGPathProperties(mockPathElement, undefined)
            expect(result).toBeUndefined()
        })

        it('should return initial unchanged for non-SVG elements', () => {
            const div = document.createElement('div')
            const initial = { pathLength: 0 }
            const result = transformInitialSVGPathProperties(div, initial)

            expect(result).toEqual(initial)
        })
    })

    describe('computeNormalizedSVGInitialAttrs', () => {
        it('should return null if no path props are present', () => {
            expect(computeNormalizedSVGInitialAttrs({ opacity: 1 })).toBeNull()
        })

        it('should compute normalized attrs when pathLength is present', () => {
            const res = computeNormalizedSVGInitialAttrs({ pathLength: 0.25 })
            expect(res).toEqual({
                pathLength: '1',
                'stroke-dasharray': '0.25 1',
                'stroke-dashoffset': '0'
            })
        })

        it('should compute dashoffset from negative pathOffset', () => {
            const res = computeNormalizedSVGInitialAttrs({ pathLength: 1, pathOffset: 0.5 })
            expect(res).toEqual({
                pathLength: '1',
                'stroke-dasharray': '1 1',
                'stroke-dashoffset': '-0.5'
            })
        })

        it('should respect explicit pathSpacing', () => {
            const res = computeNormalizedSVGInitialAttrs({ pathLength: 0.5, pathSpacing: 0.25 })
            expect(res).toEqual({
                pathLength: '1',
                'stroke-dasharray': '0.5 0.25',
                'stroke-dashoffset': '0'
            })
        })
    })
})

describe('motion-dom casing primitives', () => {
    it('should expose camelToDash and camelCaseAttributes as public exports', () => {
        // Plan 002 amendment, point 2: import both; do not vendor a copy, so
        // upstream additions track automatically on version bumps.
        expect(typeof camelToDash).toBe('function')
        expect(camelCaseAttributes).toBeInstanceOf(Set)
    })

    it('should carry 23 camelCase attribute entries (drift reference for version bumps)', () => {
        // motion-dom v12.42.2, camel-case-attrs.ts:4-28. A change here means
        // upstream extended the allowlist — re-verify the SSR casing gate.
        expect(camelCaseAttributes.size).toBe(23)
        expect(camelCaseAttributes.has('viewBox')).toBe(true)
    })

    it('should not dash-case an already-kebab key', () => {
        expect(camelToDash('stroke-width')).toBe('stroke-width')
    })
})

describe('SVG_ATTRIBUTE_PROPERTIES', () => {
    it('should include the geometry attributes upstream animates', () => {
        for (const key of [
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
            'viewBox'
        ]) {
            expect(SVG_ATTRIBUTE_PROPERTIES.has(key)).toBe(true)
        }
    })

    it('should include presentation attributes that svgEffect routes to style', () => {
        // These live in `element.style`, so svgEffect sends them through addStyleValue.
        // We still claim them out of the raw spread so they never stringify.
        for (const key of [
            'offset',
            'stopColor',
            'stopOpacity',
            'fillOpacity',
            'strokeOpacity',
            'strokeWidth'
        ]) {
            expect(SVG_ATTRIBUTE_PROPERTIES.has(key)).toBe(true)
        }
    })

    it('should include the kebab-case DOM spellings a Svelte template actually uses', () => {
        // Upstream's list is React-facing (JSX camelCase). Svelte templates take the
        // DOM spelling, so `<motion.circle stroke-width={mv}>` is the common form. A
        // kebab key missing from the allowlist is never claimed out of the raw spread
        // and renders stroke-width="[object Object]" — the bug this feature kills.
        for (const key of [
            'stop-color',
            'stop-opacity',
            'fill-opacity',
            'stroke-opacity',
            'stroke-width',
            'stroke-dashoffset',
            'stroke-dasharray'
        ]) {
            expect(SVG_ATTRIBUTE_PROPERTIES.has(key)).toBe(true)
        }
    })

    it('should not overlap with SVG_PATH_PROPERTIES (no double handling)', () => {
        const overlap = [...SVG_PATH_PROPERTIES].filter((key) => SVG_ATTRIBUTE_PROPERTIES.has(key))
        expect(overlap).toEqual([])
    })

    it('should not enumerate attr-prefixed keys (handled by prefix, not allowlist)', () => {
        expect(SVG_ATTRIBUTE_PROPERTIES.has('attrX')).toBe(false)
        expect(SVG_ATTRIBUTE_PROPERTIES.has('attrY')).toBe(false)
        expect(SVG_ATTRIBUTE_PROPERTIES.has('attrScale')).toBe(false)
    })
})

describe('resolveSVGAttrKey', () => {
    it('should map attrX/attrY/attrScale to their SVG attribute names', () => {
        // Upstream: buildSVGAttrs renders attrX -> attrs.x (build-attrs.ts:82-85)
        expect(resolveSVGAttrKey('attrX')).toBe('x')
        expect(resolveSVGAttrKey('attrY')).toBe('y')
        expect(resolveSVGAttrKey('attrScale')).toBe('scale')
    })

    it('should pass non-attr keys through untouched', () => {
        expect(resolveSVGAttrKey('cx')).toBe('cx')
        expect(resolveSVGAttrKey('strokeWidth')).toBe('strokeWidth')
        expect(resolveSVGAttrKey('viewBox')).toBe('viewBox')
    })

    it('should only strip the prefix when followed by an uppercase char', () => {
        // Mirrors upstream's /^attr([A-Z])/ conversion; `attribute` must not become `ibute`.
        expect(resolveSVGAttrKey('attribute')).toBe('attribute')
        expect(resolveSVGAttrKey('attr')).toBe('attr')
        expect(resolveSVGAttrKey('attrx')).toBe('attrx')
    })
})

describe('isSVGMotionValueAttribute', () => {
    it('should accept allowlisted attributes and attr-prefixed keys', () => {
        expect(isSVGMotionValueAttribute('cx')).toBe(true)
        expect(isSVGMotionValueAttribute('attrX')).toBe(true)
        expect(isSVGMotionValueAttribute('attrScale')).toBe(true)
    })

    it('should accept kebab-case DOM spellings', () => {
        expect(isSVGMotionValueAttribute('stroke-width')).toBe(true)
        expect(isSVGMotionValueAttribute('stroke-dashoffset')).toBe(true)
        expect(isSVGMotionValueAttribute('stop-color')).toBe(true)
    })

    it('should reject path props so the path pipeline keeps ownership', () => {
        expect(isSVGMotionValueAttribute('pathLength')).toBe(false)
        expect(isSVGMotionValueAttribute('pathOffset')).toBe(false)
        expect(isSVGMotionValueAttribute('pathSpacing')).toBe(false)
    })

    it('should reject unrelated props', () => {
        expect(isSVGMotionValueAttribute('class')).toBe(false)
        expect(isSVGMotionValueAttribute('onclick')).toBe(false)
    })
})

describe('extractSVGMotionValueAttributes', () => {
    it('should split MotionValue attributes from static attributes', () => {
        const cx = motionValue(10)
        const { motionValueAttrs, staticAttrs } = extractSVGMotionValueAttributes({
            cx,
            cy: 25,
            fill: 'red'
        })

        expect(motionValueAttrs).toEqual({ cx })
        expect(staticAttrs).toEqual({ cy: 25, fill: 'red' })
    })

    it('should keep MotionValue keys un-renamed so svgEffect can route them', () => {
        // svgEffect does its own `attr` prefix conversion (effects/svg/index.ts).
        // Pre-renaming attrX -> x would make it hit the `key in element.style`
        // branch and become a CSS style instead of an attribute.
        const scale = motionValue(2)
        const { motionValueAttrs, staticAttrs } = extractSVGMotionValueAttributes({
            attrScale: scale
        })

        expect(motionValueAttrs).toEqual({ attrScale: scale })
        expect(motionValueAttrs).not.toHaveProperty('scale')
        expect(staticAttrs).toEqual({})
    })

    it('should rename static attr-prefixed props to their attribute names', () => {
        const { motionValueAttrs, staticAttrs } = extractSVGMotionValueAttributes({
            attrX: 10,
            attrY: 20
        })

        expect(motionValueAttrs).toEqual({})
        expect(staticAttrs).toEqual({ x: 10, y: 20 })
        expect(staticAttrs).not.toHaveProperty('attrX')
    })

    it('should claim kebab-case keys without renaming them', () => {
        // `'stroke-width' in element.style` is true in Chromium, so svgEffect routes
        // the kebab key correctly on its own once we hand it over.
        const strokeWidth = motionValue(2)
        const { motionValueAttrs, staticAttrs } = extractSVGMotionValueAttributes({
            'stroke-width': strokeWidth
        })

        expect(motionValueAttrs).toEqual({ 'stroke-width': strokeWidth })
        expect(staticAttrs).toEqual({})
    })

    it('should not claim path props even when they hold MotionValues', () => {
        const pathLength = motionValue(0.5)
        const { motionValueAttrs, staticAttrs } = extractSVGMotionValueAttributes({ pathLength })

        expect(motionValueAttrs).toEqual({})
        expect(staticAttrs).toEqual({ pathLength })
    })

    it('should not claim MotionValues on non-attribute keys', () => {
        const custom = motionValue(1)
        const { motionValueAttrs, staticAttrs } = extractSVGMotionValueAttributes({ custom })

        expect(motionValueAttrs).toEqual({})
        expect(staticAttrs).toEqual({ custom })
    })

    it('should leave plain objects that are not MotionValues untouched', () => {
        const notAValue = { get: () => 5 }
        const { motionValueAttrs, staticAttrs } = extractSVGMotionValueAttributes({ cx: notAValue })

        expect(motionValueAttrs).toEqual({})
        expect(staticAttrs).toEqual({ cx: notAValue })
    })

    it('should handle an empty prop bag', () => {
        expect(extractSVGMotionValueAttributes({})).toEqual({
            motionValueAttrs: {},
            staticAttrs: {}
        })
    })

    it('should not mutate the input object', () => {
        const cx = motionValue(10)
        const rest = { cx, attrX: 4, fill: 'blue' }
        extractSVGMotionValueAttributes(rest)

        expect(rest).toEqual({ cx, attrX: 4, fill: 'blue' })
    })
})

describe('computeSSRSVGAttrValues', () => {
    it('should render the current value of each MotionValue as a string', () => {
        expect(computeSSRSVGAttrValues({ cx: motionValue(10), r: motionValue(4.5) })).toEqual({
            cx: '10',
            r: '4.5'
        })
    })

    it('should resolve attr-prefixed keys to their attribute names', () => {
        expect(
            computeSSRSVGAttrValues({ attrX: motionValue(3), attrScale: motionValue(2) })
        ).toEqual({ x: '3', scale: '2' })
    })

    it('should emit kebab-case DOM names for hyphenated camelCase keys', () => {
        // SVG attribute names are case-sensitive: a `strokeDashoffset` attribute is
        // inert, so the value would flash on hydration.
        expect(
            computeSSRSVGAttrValues({
                strokeDashoffset: motionValue(4),
                stopColor: motionValue('red')
            })
        ).toEqual({ 'stroke-dashoffset': '4', 'stop-color': 'red' })
    })

    it('should leave already-kebab keys untouched', () => {
        expect(computeSSRSVGAttrValues({ 'stroke-width': motionValue(2) })).toEqual({
            'stroke-width': '2'
        })
    })

    it('should preserve camelCase attribute names that must stay camelCase', () => {
        // motion-dom's `camelCaseAttributes` set: naive dash-casing would emit the
        // inert `view-box`.
        expect(computeSSRSVGAttrValues({ viewBox: motionValue('0 0 10 10') })).toEqual({
            viewBox: '0 0 10 10'
        })
    })

    it('should strip the attr prefix BEFORE applying the casing gate', () => {
        // Plan 002 amendment, normative point 4. `attrX` is not in
        // `camelCaseAttributes`, so gating first dash-cases it to the inert
        // `attr-x`. Upstream's `buildSVGAttrs` destructures attrX/attrY/attrScale
        // into attrs.x/y/scale *before* `renderSVG` applies the gate
        // (build-attrs.ts:23-25,82-85 -> render.ts:15-19).
        const attrs = computeSSRSVGAttrValues({
            attrX: motionValue(3),
            attrY: motionValue(4),
            attrScale: motionValue(2)
        })

        expect(attrs).toEqual({ x: '3', y: '4', scale: '2' })
        expect(attrs).not.toHaveProperty('attr-x')
        expect(attrs).not.toHaveProperty('attr-y')
        expect(attrs).not.toHaveProperty('attr-scale')
    })

    it('should honor upstream camelCase entries beyond the ones we hand-picked', () => {
        // Guards against vendoring a hand-written copy of the allowlist: these
        // filter-primitive keys only survive if motion-dom's own
        // `camelCaseAttributes` is the gate (camel-case-attrs.ts:4-28).
        expect(
            computeSSRSVGAttrValues({
                stdDeviation: motionValue(2),
                baseFrequency: motionValue(0.05),
                numOctaves: motionValue(3)
            })
        ).toEqual({ stdDeviation: '2', baseFrequency: '0.05', numOctaves: '3' })
    })

    it('should never emit [object Object]', () => {
        const attrs = computeSSRSVGAttrValues({ cx: motionValue(10), attrY: motionValue(2) })
        for (const value of Object.values(attrs)) {
            expect(value).not.toContain('[object Object]')
        }
    })

    it('should omit attributes whose current value is null or undefined', () => {
        expect(
            computeSSRSVGAttrValues({ cx: motionValue(null), cy: motionValue(undefined) })
        ).toEqual({})
    })

    it('should return an empty object when there are no MotionValue attrs', () => {
        expect(computeSSRSVGAttrValues({})).toEqual({})
    })
})
