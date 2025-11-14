import { describe, expect, it } from 'vitest'
import { isDomElement } from './dom'

describe('utils/dom:isDomElement', () => {
    it('returns true for an HTMLElement', () => {
        const el = document.createElement('div')
        expect(isDomElement(el)).toBe(true)
    })

    it('returns false for null and non-elements', () => {
        expect(isDomElement(null)).toBe(false)
        expect(isDomElement(undefined)).toBe(false)
        expect(isDomElement(123)).toBe(false)
        expect(isDomElement('div')).toBe(false)
        expect(isDomElement({})).toBe(false)
        // window should not be considered an Element
        if (typeof window !== 'undefined') {
            expect(isDomElement(window)).toBe(false)
        }
    })

    it('returns false for non-Element DOM nodes (e.g., Text)', () => {
        const text = document.createTextNode('hello')
        // Text is a Node but not an Element
        expect(isDomElement(text)).toBe(false)
    })
})
