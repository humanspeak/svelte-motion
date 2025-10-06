/**
 * @vitest-environment jsdom
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    hasSVGPathProperties,
    isSVGPathElement,
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

        it('should return false for regular properties', () => {
            expect(hasSVGPathProperties({ opacity: 1, x: 100 })).toBe(false)
        })
    })

    describe('transformSVGPathProperties', () => {
        it('should transform pathLength to strokeDasharray', () => {
            const keyframes = { pathLength: 1 }
            const result = transformSVGPathProperties(mockPathElement, keyframes)

            expect(result).toEqual({ strokeDasharray: '1 1' })
            expect(result).not.toHaveProperty('pathLength')
            expect(mockPathElement.setAttribute).toHaveBeenCalledWith('pathLength', '1')
        })

        it('should transform pathLength array to strokeDasharray array', () => {
            const keyframes = { pathLength: [0, 0.5, 1] }
            const result = transformSVGPathProperties(mockPathElement, keyframes)

            expect(result).toEqual({ strokeDasharray: ['0 1', '0.5 1', '1 1'] })
            expect(result).not.toHaveProperty('pathLength')
        })

        it('should transform pathOffset to strokeDashoffset', () => {
            const keyframes = { pathOffset: 0.5 }
            const result = transformSVGPathProperties(mockPathElement, keyframes)

            expect(result).toEqual({ strokeDashoffset: -0.5 })
            expect(result).not.toHaveProperty('pathOffset')
        })

        it('should transform pathOffset array to strokeDashoffset array', () => {
            const keyframes = { pathOffset: [0, 0.5, 1] }
            const result = transformSVGPathProperties(mockPathElement, keyframes)

            expect(result).toEqual({ strokeDashoffset: [0, -0.5, -1] })
        })

        it('should handle both pathLength and pathOffset together', () => {
            const keyframes = { pathLength: 1, pathOffset: 0.5 }
            const result = transformSVGPathProperties(mockPathElement, keyframes)

            expect(result).toEqual({
                strokeDasharray: '1 1',
                strokeDashoffset: -0.5
            })
        })

        it('should preserve other properties', () => {
            const keyframes = { pathLength: 1, opacity: 0.5, x: 100 }
            const result = transformSVGPathProperties(mockPathElement, keyframes)

            expect(result).toEqual({
                strokeDasharray: '1 1',
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

        it('should handle pathSpacing by removing it', () => {
            const keyframes = { pathLength: 1, pathSpacing: 0.5 }
            const result = transformSVGPathProperties(mockPathElement, keyframes)

            expect(result).not.toHaveProperty('pathSpacing')
            expect(result).toHaveProperty('strokeDasharray')
        })
    })

    describe('transformInitialSVGPathProperties', () => {
        it('should transform initial properties', () => {
            const initial = { pathLength: 0, opacity: 1 }
            const result = transformInitialSVGPathProperties(mockPathElement, initial)

            expect(result).toEqual({
                strokeDasharray: '0 1',
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
})
