import htmlTags from 'html-tags'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import svgTags from 'svg-tags'
import { describe, expect, it } from 'vitest'
import { svelteMotionOptimize } from '../vite'
import {
    FORBIDDEN_GENERATED_IDENTIFIERS,
    toComponentFileName,
    toComponentName,
    toExportSpecifier,
    toPublicName
} from './componentNames'

const EXCLUDED_HTML_TAGS = new Set([
    'script',
    'style',
    'link',
    'meta',
    'title',
    'head',
    'html',
    'body'
])
const DEPRECATED_SVG_TAGS = new Set([
    'animatecolor',
    'altglyph',
    'altglyphdef',
    'altglyphitem',
    'glyph',
    'glyphref',
    'hkern',
    'vkern',
    'missing-glyph',
    'font',
    'font-face',
    'font-face-format',
    'font-face-name',
    'font-face-src',
    'font-face-uri',
    'color-profile'
])

/**
 * All tags the generator emits wrappers for. Mirrors the tag universe in
 * scripts/generate-html.ts so this test guards the shared mapping against
 * regressions (and against future html-tags/svg-tags additions) in CI.
 */
const ALL_TAGS = [
    ...new Set([
        ...htmlTags.map((tag) => tag.toLowerCase()).filter((tag) => !EXCLUDED_HTML_TAGS.has(tag)),
        ...svgTags.map((tag) => tag.toLowerCase()).filter((tag) => !DEPRECATED_SVG_TAGS.has(tag))
    ])
].sort()

const HTML_SOURCE_DIR = path.join(process.cwd(), 'src/lib/html')
const INDEX_SOURCE = readFileSync(path.join(HTML_SOURCE_DIR, 'index.ts'), 'utf8')
const EXPORT_SPECIFIERS = new Set(
    INDEX_SOURCE.slice(
        INDEX_SOURCE.indexOf('export {') + 'export {'.length,
        INDEX_SOURCE.indexOf('\n}')
    )
        .split(',')
        .map((specifier) => specifier.trim())
)

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
        expect(toExportSpecifier('object')).toBe('HtmlObject as Object')
        expect(toExportSpecifier('div')).toBe('Div')
    })

    it('never maps any generated tag to a forbidden identifier', () => {
        for (const tag of ALL_TAGS) {
            expect(FORBIDDEN_GENERATED_IDENTIFIERS.has(toComponentName(tag)), tag).toBe(false)
            expect(FORBIDDEN_GENERATED_IDENTIFIERS.has(toComponentFileName(tag)), tag).toBe(false)
        }
    })

    it('keeps generated files, barrel bindings, public exports, and optimizer paths aligned', () => {
        const plugin = svelteMotionOptimize()

        for (const tag of ALL_TAGS) {
            const componentName = toComponentName(tag)
            const fileName = toComponentFileName(tag)
            const exportSpecifier = toExportSpecifier(tag)
            const componentPath = path.join(HTML_SOURCE_DIR, `${fileName}.svelte`)

            expect(existsSync(componentPath), `${tag} component file`).toBe(true)
            expect(
                INDEX_SOURCE.includes(
                    `import ${componentName} from '$lib/html/${fileName}.svelte'`
                ),
                `${tag} barrel import`
            ).toBe(true)
            expect(EXPORT_SPECIFIERS.has(exportSpecifier), `${tag} public export`).toBe(true)

            const source = `<script>import { motion } from '@humanspeak/svelte-motion'</script>\n<motion.${tag} />`
            const transformed = (
                plugin.transform as (code: string, id: string) => { code: string } | null
            )(source, 'Consistency.svelte')

            expect(transformed, `${tag} optimizer transform`).not.toBeNull()
            expect(
                transformed?.code.includes(
                    `import SvelteMotion${componentName} from '@humanspeak/svelte-motion/html/${fileName}.svelte'`
                ),
                `${tag} optimizer import`
            ).toBe(true)
        }
    })
})
