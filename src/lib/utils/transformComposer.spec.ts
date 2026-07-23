import { describe, expect, it } from 'vitest'
import { buildGestureTransform } from './transformComposer.js'

describe('buildGestureTransform — canonical perspective ordering', () => {
    it('hoists an authored perspective ahead of generated channels', () => {
        // Upstream emits transformPerspective FIRST (motion-dom keys-transform.ts
        // `transformPropOrder`, index 0). Authored `perspective(...)` must precede
        // the gesture-generated channels, not trail them.
        expect(buildGestureTransform({ scale: 1.2 }, 'perspective(600px)')).toBe(
            'perspective(600px) scale(1.2)'
        )
    })

    it('hoists perspective ahead of everything and keeps the remaining base after channels', () => {
        expect(buildGestureTransform({ scale: 1.2 }, 'perspective(600px) rotateX(20deg)')).toBe(
            'perspective(600px) scale(1.2) rotateX(20deg)'
        )
    })

    it('hoists multiple perspective tokens in authored order', () => {
        expect(buildGestureTransform({ scale: 1.2 }, 'perspective(600px) perspective(800px)')).toBe(
            'perspective(600px) perspective(800px) scale(1.2)'
        )
    })

    it('leaves a base without perspective appended after generated channels (unchanged)', () => {
        expect(buildGestureTransform({ scale: 1.2 }, 'translateX(20px)')).toBe(
            'scale(1.2) translateX(20px)'
        )
    })

    it('returns only generated channels when the base is empty (unchanged)', () => {
        expect(buildGestureTransform({ scale: 1.2 }, '')).toBe('scale(1.2)')
    })

    it('returns only the base when there are no generated channels (unchanged)', () => {
        expect(buildGestureTransform({}, 'perspective(600px)')).toBe('perspective(600px)')
    })

    it('passes a perspective(var(...)) base through untouched (documented bound)', () => {
        // The conservative extractor only lifts simple `perspective(<length>)`
        // tokens; a nested function value (e.g. var()) is left in place and keeps
        // the pre-fix base-last position rather than risk a corrupt partial parse.
        expect(buildGestureTransform({ scale: 1.2 }, 'perspective(var(--p))')).toBe(
            'scale(1.2) perspective(var(--p))'
        )
    })
})
