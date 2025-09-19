import { describe, expect, it } from 'vitest'
import { VOID_TAGS } from './constants.js'

describe('utils/constants', () => {
    it('VOID_TAGS: contains standard void elements', () => {
        expect(VOID_TAGS.has('img')).toBe(true)
        expect(VOID_TAGS.has('br')).toBe(true)
        expect(VOID_TAGS.has('input')).toBe(true)
    })

    it('VOID_TAGS: negative - does not contain non-void elements', () => {
        expect(VOID_TAGS.has('div')).toBe(false)
        expect(VOID_TAGS.has('span')).toBe(false)
    })
})
