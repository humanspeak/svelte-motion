import { describe, expect, it } from 'vitest'
import { isDomElement, isRefPending, resolveElement } from './dom'

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

describe('utils/dom:resolveElement', () => {
    it('returns undefined when ref is missing', () => {
        expect(resolveElement(undefined)).toBeUndefined()
    })

    it('returns the element when ref is a direct HTMLElement', () => {
        const el = document.createElement('div')
        expect(resolveElement(el)).toBe(el)
    })

    it('invokes the getter and returns its value', () => {
        const el = document.createElement('span')
        expect(resolveElement(() => el)).toBe(el)
    })

    it('coerces null getter result to undefined', () => {
        expect(resolveElement(() => null)).toBeUndefined()
    })

    it('returns undefined when getter returns undefined', () => {
        expect(resolveElement(() => undefined)).toBeUndefined()
    })
})

describe('utils/dom:isRefPending', () => {
    it('returns false when ref is missing (absent, not pending)', () => {
        expect(isRefPending(undefined)).toBe(false)
    })

    it('returns false for a direct HTMLElement (already resolved)', () => {
        const el = document.createElement('div')
        expect(isRefPending(el)).toBe(false)
    })

    it('returns true when getter returns undefined', () => {
        expect(isRefPending(() => undefined)).toBe(true)
    })

    it('returns true when getter returns null', () => {
        expect(isRefPending(() => null)).toBe(true)
    })

    it('returns false when getter returns an element', () => {
        const el = document.createElement('section')
        expect(isRefPending(() => el)).toBe(false)
    })

    it('reflects dynamic hydration — false once the getter starts returning an element', () => {
        const ref: { current?: HTMLElement } = {}
        const get = () => ref.current
        expect(isRefPending(get)).toBe(true)
        ref.current = document.createElement('div')
        expect(isRefPending(get)).toBe(false)
    })
})
