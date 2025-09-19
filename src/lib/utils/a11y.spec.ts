import { describe, expect, it } from 'vitest'
import { isNativelyFocusable } from './a11y.js'

describe('utils/a11y - isNativelyFocusable', () => {
    it('respects explicit tabindex and tabIndex attributes', () => {
        expect(isNativelyFocusable('div', { tabindex: 0 })).toBe(true)
        expect(isNativelyFocusable('div', { tabIndex: -1 })).toBe(true)
    })

    it('treats contenteditable as focusable', () => {
        expect(isNativelyFocusable('div', { contenteditable: 'true' })).toBe(true)
    })

    it('anchors are focusable only with href', () => {
        expect(isNativelyFocusable('a', {})).toBe(false)
        expect(isNativelyFocusable('a', { href: '' })).toBe(false)
        expect(isNativelyFocusable('a', { href: 'https://example.com' })).toBe(true)
    })

    it('standard controls are focusable regardless of attributes', () => {
        expect(isNativelyFocusable('button', {})).toBe(true)
        expect(isNativelyFocusable('input', {})).toBe(true)
        expect(isNativelyFocusable('select', {})).toBe(true)
        expect(isNativelyFocusable('textarea', {})).toBe(true)
        expect(isNativelyFocusable('summary', {})).toBe(true)
    })

    it('non-controls without tabindex are not focusable', () => {
        expect(isNativelyFocusable('div', {})).toBe(false)
        expect(isNativelyFocusable('span', {})).toBe(false)
        expect(isNativelyFocusable('section', {})).toBe(false)
    })
})
