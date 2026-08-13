/**
 * @vitest-environment jsdom
 */
import { camelCaseAttributes, camelToDash, motionValue } from 'motion-dom'
import { describe, expect, it } from 'vitest'
import {
    computeNormalizedSVGInitialAttrs,
    computeSSRSVGAttrValues,
    computeSSRSVGStyleValues,
    extractSVGMotionValueAttributes,
    isSVGMotionValueAttribute,
    resolveSVGAttrKey,
    resolveSVGTagName,
    SVG_TAG_CASING,
    SVG_TAGS
} from './svg'

describe('svg utilities', () => {
    // The SVGPathElement fixture and its `setAttribute` spy lived here for the
    // deleted `transformSVGPathProperties` family, which wrote attributes to a
    // live element. `buildSVGPath` composes them into the VE's render state
    // instead, so nothing left in this block needs a DOM node.

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

describe('resolveSVGTagName', () => {
    it('should restore the spec casing of filter primitives', () => {
        // SVG tag names are case-sensitive; `fedisplacementmap` in the SVG namespace
        // is an inert SVGElement, so its `scale` attribute does nothing.
        expect(resolveSVGTagName('fedisplacementmap')).toBe('feDisplacementMap')
        expect(resolveSVGTagName('feturbulence')).toBe('feTurbulence')
        expect(resolveSVGTagName('fegaussianblur')).toBe('feGaussianBlur')
        expect(resolveSVGTagName('fefunca')).toBe('feFuncA')
    })

    it('should restore the spec casing of non-filter camelCase elements', () => {
        expect(resolveSVGTagName('clippath')).toBe('clipPath')
        expect(resolveSVGTagName('lineargradient')).toBe('linearGradient')
        expect(resolveSVGTagName('radialgradient')).toBe('radialGradient')
        expect(resolveSVGTagName('textpath')).toBe('textPath')
        expect(resolveSVGTagName('foreignobject')).toBe('foreignObject')
        expect(resolveSVGTagName('animatetransform')).toBe('animateTransform')
    })

    it('should pass through all-lowercase SVG tags and non-SVG tags', () => {
        expect(resolveSVGTagName('circle')).toBe('circle')
        expect(resolveSVGTagName('path')).toBe('path')
        expect(resolveSVGTagName('div')).toBe('div')
    })

    it('should be idempotent on already-correct casing', () => {
        expect(resolveSVGTagName('feDisplacementMap')).toBe('feDisplacementMap')
        expect(resolveSVGTagName('clipPath')).toBe('clipPath')
    })

    it('should only map tags that are recognized SVG elements', () => {
        for (const lower of Object.keys(SVG_TAG_CASING)) {
            expect(SVG_TAGS.has(lower)).toBe(true)
        }
    })

    it('should produce a canonical name that lowercases back to its key', () => {
        for (const [lower, canonical] of Object.entries(SVG_TAG_CASING)) {
            expect(canonical.toLowerCase()).toBe(lower)
        }
    })

    it('should create a live element for a canonicalized filter primitive', () => {
        const el = document.createElementNS(
            'http://www.w3.org/2000/svg',
            resolveSVGTagName('fedisplacementmap')
        )
        expect(el.tagName).toBe('feDisplacementMap')
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

    it('should accept path props so svgEffect can select its path writer', () => {
        expect(isSVGMotionValueAttribute('pathLength')).toBe(true)
        expect(isSVGMotionValueAttribute('pathOffset')).toBe(true)
        expect(isSVGMotionValueAttribute('pathSpacing')).toBe(true)
    })

    it('should claim every MotionValue prop like upstream SVG scraping', () => {
        for (const key of ['fill', 'stroke', 'opacity', 'transform', 'offsetDistance', 'custom']) {
            expect(isSVGMotionValueAttribute(key)).toBe(true)
        }
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

    it('should claim path props for the SVG path pipeline', () => {
        const pathLength = motionValue(0.5)
        const { motionValueAttrs, staticAttrs } = extractSVGMotionValueAttributes({ pathLength })

        expect(motionValueAttrs).toEqual({ pathLength })
        expect(staticAttrs).toEqual({})
    })

    it('should claim custom MotionValue attributes like upstream', () => {
        const custom = motionValue(1)
        const { motionValueAttrs, staticAttrs } = extractSVGMotionValueAttributes({ custom })

        expect(motionValueAttrs).toEqual({ custom })
        expect(staticAttrs).toEqual({})
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

describe('filter-primitive attributes', () => {
    // Plan 005 drives feTurbulence/feOffset/feGaussianBlur from MotionValues. An
    // unclaimed key falls through to the raw spread and renders `[object Object]`,
    // the exact failure this feature exists to eliminate.

    it('should claim the camelCase filter keys that upstream lists', () => {
        // Resolved against motion-dom's exported `camelCaseAttributes` rather than a
        // hand-written list, so upstream additions track on version bumps.
        for (const key of ['stdDeviation', 'baseFrequency', 'numOctaves']) {
            expect(camelCaseAttributes.has(key)).toBe(true)
            expect(isSVGMotionValueAttribute(key)).toBe(true)
        }
    })

    it('should claim the lowercase filter keys upstream cannot cover', () => {
        // `camelCaseAttributes` only lists camelCase names, so these need adding
        // explicitly — they are not in it.
        for (const key of ['dx', 'dy', 'radius']) {
            expect(camelCaseAttributes.has(key)).toBe(false)
            expect(isSVGMotionValueAttribute(key)).toBe(true)
        }
    })

    it('should route filter keys into motionValueAttrs, never the raw spread', () => {
        const values = {
            stdDeviation: motionValue(4),
            baseFrequency: motionValue(0.05),
            numOctaves: motionValue(2),
            dx: motionValue(3),
            dy: motionValue(3),
            radius: motionValue(1)
        }
        const { motionValueAttrs, staticAttrs } = extractSVGMotionValueAttributes({ ...values })

        expect(Object.keys(motionValueAttrs).sort()).toEqual(Object.keys(values).sort())
        expect(staticAttrs).toEqual({})
    })

    it("should claim pathLength for svgEffect's dedicated path writer", () => {
        expect(camelCaseAttributes.has('pathLength')).toBe(true)
        expect(isSVGMotionValueAttribute('pathLength')).toBe(true)

        const pathLength = motionValue(0.5)
        const { motionValueAttrs, staticAttrs } = extractSVGMotionValueAttributes({ pathLength })

        expect(motionValueAttrs).toEqual({ pathLength })
        expect(staticAttrs).toEqual({})
    })

    it('should keep static filter values out of motionValueAttrs', () => {
        const { motionValueAttrs, staticAttrs } = extractSVGMotionValueAttributes({
            stdDeviation: 4,
            dx: 3
        })

        expect(motionValueAttrs).toEqual({})
        expect(staticAttrs).toEqual({ stdDeviation: 4, dx: 3 })
    })

    it('should claim custom MotionValue keys', () => {
        const custom = motionValue(1)
        const { motionValueAttrs, staticAttrs } = extractSVGMotionValueAttributes({ custom })

        expect(motionValueAttrs).toEqual({ custom })
        expect(staticAttrs).toEqual({})
    })

    it('should SSR filter keys with their camelCase names preserved', () => {
        const { motionValueAttrs } = extractSVGMotionValueAttributes({
            stdDeviation: motionValue(4),
            dx: motionValue(3)
        })

        expect(computeSSRSVGAttrValues(motionValueAttrs)).toEqual({
            stdDeviation: '4',
            dx: '3'
        })
    })
})

describe('computeSSRSVGAttrValues', () => {
    it('should render the current value of each MotionValue as a string', () => {
        expect(computeSSRSVGAttrValues({ cx: motionValue(10), r: motionValue(4.5) })).toEqual({
            cx: '10',
            r: '4.5'
        })
    })

    it('should leave Motion 13 CSS channels out of the attribute spread', () => {
        expect(
            computeSSRSVGAttrValues({
                opacity: motionValue(0.5),
                transform: motionValue('translateX(10px)'),
                fill: motionValue('red')
            })
        ).toEqual({ fill: 'red' })
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
        //
        // Routed through `extractSVGMotionValueAttributes` on purpose. Handing the
        // keys straight to the SSR helper bypasses classification, which is how a
        // filter primitive rendering `[object Object]` survived a fully green suite.
        const { motionValueAttrs } = extractSVGMotionValueAttributes({
            stdDeviation: motionValue(2),
            baseFrequency: motionValue(0.05),
            numOctaves: motionValue(3)
        })

        expect(computeSSRSVGAttrValues(motionValueAttrs)).toEqual({
            stdDeviation: '2',
            baseFrequency: '0.05',
            numOctaves: '3'
        })
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

describe('computeSSRSVGStyleValues', () => {
    it('should seed the Motion 13 SVG CSS channels and exclude paint attributes', () => {
        expect(
            computeSSRSVGStyleValues({
                opacity: motionValue(0.5),
                transform: motionValue('translateX(10px)'),
                offsetDistance: motionValue('25%'),
                fill: motionValue('red')
            })
        ).toEqual({
            opacity: 0.5,
            transform: 'translateX(10px)',
            offsetDistance: '25%'
        })
    })
})
