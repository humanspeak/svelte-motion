import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, test } from 'node:test'

import { createSitemapResponse } from '@humanspeak/docs-kit/server'

import { competitors, ours } from '../src/lib/compare-data'

const root = process.cwd()

async function read(relativePath: string): Promise<string> {
    return readFile(join(root, relativePath), 'utf8')
}

describe('generated GEO and SEO artifacts', () => {
    test('publishes a Markdown mirror for every comparison page', async () => {
        const index = await read('static/compare/index.md')

        for (const competitor of competitors) {
            const canonical = `${ours.url}/compare/${competitor.slug}`
            const mirror = await read(`static/compare/${competitor.slug}.md`)

            assert.match(index, new RegExp(`${competitor.slug}\\.md`))
            assert.ok(mirror.includes(`<!-- Canonical: ${canonical} -->`))
            assert.ok(mirror.includes(`# ${ours.name} vs ${competitor.name}`))
            assert.ok(mirror.includes('## Feature comparison'))
            assert.ok(mirror.includes('## Verdict'))
        }
    })

    test('advertises every comparison in both LLM discovery files', async () => {
        const [index, full] = await Promise.all([
            read('static/llms.txt'),
            read('static/llms-full.txt')
        ])

        assert.ok(index.includes('## Comparisons'))
        for (const competitor of competitors) {
            const canonical = `${ours.url}/compare/${competitor.slug}`
            assert.ok(index.includes(`(${canonical}.md): ${canonical}`))
            assert.ok(full.includes(`# ${ours.name} vs ${competitor.name}`))
        }
    })

    test('emits concrete comparison sitemap URLs without dynamic placeholders', async () => {
        const manifest = JSON.parse(await read('src/lib/sitemap-manifest.json')) as Record<
            string,
            string
        >
        const response = createSitemapResponse({ manifest, siteUrl: ours.url })
        const xml = await response.text()

        assert.doesNotMatch(xml, /\[[^\]]+\]/)
        for (const competitor of competitors) {
            assert.ok(xml.includes(`<loc>${ours.url}/compare/${competitor.slug}</loc>`))
        }
    })
})
