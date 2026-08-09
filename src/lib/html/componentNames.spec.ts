import htmlTags from 'html-tags'
import svgTags from 'svg-tags'
import { describe, expect, it } from 'vitest'
import {
    JS_GLOBAL_NAMES,
    toComponentFileName,
    toComponentName,
    toPublicName
} from './componentNames'

/**
 * All tags the generator emits wrappers for. Mirrors the tag universe in
 * scripts/generate-html.ts so this test guards the shared mapping against
 * regressions (and against future html-tags/svg-tags additions) in CI.
 */
const ALL_TAGS = [
    ...new Set([...htmlTags.map((t) => t.toLowerCase()), ...svgTags.map((t) => t.toLowerCase())])
].sort()

describe('componentNames', () => {
    it('renames JS-global-colliding tags to safe identifiers', () => {
        expect(toComponentName('object')).toBe('HtmlObject')
        expect(toComponentName('map')).toBe('HtmlMap')
        expect(toComponentName('math')).toBe('HtmlMath')
        expect(toComponentName('symbol')).toBe('HtmlSymbol')
        // `set` collides only as a barrel binding — the file is already `SetElement.svelte`.
        expect(toComponentName('set')).toBe('HtmlSet')
        expect(toComponentFileName('set')).toBe('SetElement')
    })

    it('keeps non-colliding tags unchanged', () => {
        expect(toComponentName('div')).toBe('Div')
        expect(toComponentFileName('div')).toBe('Div')
        expect(toComponentName('textpath')).toBe('Textpath')
        expect(toComponentFileName('textpath')).toBe('Textpath')
    })

    it('preserves the public PascalCase export names', () => {
        expect(toPublicName('object')).toBe('Object')
        expect(toPublicName('set')).toBe('Set')
        expect(toPublicName('div')).toBe('Div')
    })

    it('never maps any generated tag to a JS-global-named component', () => {
        for (const tag of ALL_TAGS) {
            expect(JS_GLOBAL_NAMES.has(toComponentName(tag)), tag).toBe(false)
            expect(JS_GLOBAL_NAMES.has(toComponentFileName(tag)), tag).toBe(false)
        }
    })
})
