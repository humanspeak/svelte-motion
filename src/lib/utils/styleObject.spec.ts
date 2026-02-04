import { describe, expect, it } from 'vitest'
import { stringifyStyleObject } from './styleObject.js'

describe('stringifyStyleObject', () => {
    it('converts camelCase keys to kebab-case', () => {
        const result = stringifyStyleObject({
            backgroundColor: 'red',
            borderRadius: '10px',
            fontSize: '14px'
        })
        expect(result).toContain('background-color: red')
        expect(result).toContain('border-radius: 10px')
        expect(result).toContain('font-size: 14px')
    })

    it('adds px to numeric values by default', () => {
        const result = stringifyStyleObject({
            width: 100,
            height: 50,
            padding: 20
        })
        expect(result).toContain('width: 100px')
        expect(result).toContain('height: 50px')
        expect(result).toContain('padding: 20px')
    })

    it('does NOT add px to zIndex (unitless property)', () => {
        const result = stringifyStyleObject({
            zIndex: 3
        })
        expect(result).toBe('z-index: 3')
        expect(result).not.toContain('3px')
    })

    it('does NOT add px to opacity (unitless property)', () => {
        const result = stringifyStyleObject({
            opacity: 0.5
        })
        expect(result).toBe('opacity: 0.5')
        expect(result).not.toContain('0.5px')
    })

    it('does NOT add px to fontWeight (unitless property)', () => {
        const result = stringifyStyleObject({
            fontWeight: 600
        })
        expect(result).toBe('font-weight: 600')
        expect(result).not.toContain('600px')
    })

    it('does NOT add px to lineHeight (unitless property)', () => {
        const result = stringifyStyleObject({
            lineHeight: 1.5
        })
        expect(result).toBe('line-height: 1.5')
        expect(result).not.toContain('1.5px')
    })

    it('does NOT add px to flex (unitless property)', () => {
        const result = stringifyStyleObject({
            flex: 1
        })
        expect(result).toBe('flex: 1')
        expect(result).not.toContain('1px')
    })

    it('does NOT add px to flexGrow and flexShrink (unitless properties)', () => {
        const result = stringifyStyleObject({
            flexGrow: 1,
            flexShrink: 0
        })
        expect(result).toContain('flex-grow: 1')
        expect(result).toContain('flex-shrink: 0')
        expect(result).not.toContain('1px')
        expect(result).not.toContain('0px')
    })

    it('does NOT add px to order (unitless property)', () => {
        const result = stringifyStyleObject({
            order: 2
        })
        expect(result).toBe('order: 2')
        expect(result).not.toContain('2px')
    })

    it('does NOT add px to scale (unitless property)', () => {
        const result = stringifyStyleObject({
            scale: 1.5
        })
        expect(result).toBe('scale: 1.5')
        expect(result).not.toContain('1.5px')
    })

    it('does NOT add px to scaleX, scaleY, scaleZ (unitless properties)', () => {
        const result = stringifyStyleObject({
            scaleX: 0.8,
            scaleY: 1.2,
            scaleZ: 1
        })
        expect(result).toContain('scale-x: 0.8')
        expect(result).toContain('scale-y: 1.2')
        expect(result).toContain('scale-z: 1')
        expect(result).not.toContain('px')
    })

    it('adds deg to numeric rotate and skew values', () => {
        const result = stringifyStyleObject({
            rotate: 45,
            rotateX: 15,
            rotateY: -30,
            rotateZ: 90,
            skew: 12,
            skewX: -8,
            skewY: 6
        })
        expect(result).toContain('rotate: 45deg')
        expect(result).toContain('rotate-x: 15deg')
        expect(result).toContain('rotate-y: -30deg')
        expect(result).toContain('rotate-z: 90deg')
        expect(result).toContain('skew: 12deg')
        expect(result).toContain('skew-x: -8deg')
        expect(result).toContain('skew-y: 6deg')
    })

    it('preserves string values for degree properties', () => {
        const result = stringifyStyleObject({
            rotate: '45deg',
            skewX: '10deg'
        })
        expect(result).toContain('rotate: 45deg')
        expect(result).toContain('skew-x: 10deg')
    })

    it('handles mixed unitless and unit-required properties', () => {
        const result = stringifyStyleObject({
            width: 200,
            height: 100,
            zIndex: 5,
            opacity: 0.8,
            padding: 15
        })
        expect(result).toContain('width: 200px')
        expect(result).toContain('height: 100px')
        expect(result).toContain('z-index: 5') // no px
        expect(result).toContain('opacity: 0.8') // no px
        expect(result).toContain('padding: 15px')
    })

    it('preserves string values as-is', () => {
        const result = stringifyStyleObject({
            width: '50%',
            height: 'auto',
            backgroundColor: '#fff'
        })
        expect(result).toContain('width: 50%')
        expect(result).toContain('height: auto')
        expect(result).toContain('background-color: #fff')
    })

    it('handles empty object', () => {
        const result = stringifyStyleObject({})
        expect(result).toBe('')
    })

    it('joins multiple properties with semicolon and space', () => {
        const result = stringifyStyleObject({
            width: 100,
            height: 50
        })
        expect(result).toBe('width: 100px; height: 50px')
    })

    it('handles zero values for rotate and skew with deg unit', () => {
        const result = stringifyStyleObject({
            rotate: 0,
            skew: 0,
            skewX: 0,
            skewY: 0
        })
        expect(result).toContain('rotate: 0deg')
        expect(result).toContain('skew: 0deg')
        expect(result).toContain('skew-x: 0deg')
        expect(result).toContain('skew-y: 0deg')
    })

    it('handles negative scale values (reflection)', () => {
        const result = stringifyStyleObject({
            scale: -1,
            scaleX: -0.5,
            scaleY: -2
        })
        expect(result).toContain('scale: -1')
        expect(result).toContain('scale-x: -0.5')
        expect(result).toContain('scale-y: -2')
        expect(result).not.toContain('px')
    })

    it('handles negative rotation values', () => {
        const result = stringifyStyleObject({
            rotate: -45,
            rotateX: -90,
            skewX: -15
        })
        expect(result).toContain('rotate: -45deg')
        expect(result).toContain('rotate-x: -90deg')
        expect(result).toContain('skew-x: -15deg')
    })

    it('handles zero values for unitless properties', () => {
        const result = stringifyStyleObject({
            opacity: 0,
            zIndex: 0,
            scale: 0,
            order: 0
        })
        expect(result).toContain('opacity: 0')
        expect(result).toContain('z-index: 0')
        expect(result).toContain('scale: 0')
        expect(result).toContain('order: 0')
        expect(result).not.toContain('0px')
        expect(result).not.toContain('0deg')
    })
})
