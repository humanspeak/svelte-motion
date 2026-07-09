/**
 * @vitest-environment jsdom
 */
import { motionValue } from 'motion-dom'
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
