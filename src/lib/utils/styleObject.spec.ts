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
})
