import { svelte } from '@sveltejs/vite-plugin-svelte'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import './verify-tree-shaking.mjs'
import './verify-types.mjs'

/**
 * Loads and server-renders a consumer component through Vite 6.
 *
 * @param {string} entry The root-relative Svelte component path.
 * @param {import('vite').InlineConfig} config Vite configuration used to load the component.
 * @returns {Promise<string>} The server-rendered HTML.
 */
const renderWithVite = async (entry, config) => {
    const server = await createServer({
        root: import.meta.dirname,
        ...config,
        server: { middlewareMode: true },
        appType: 'custom',
        logLevel: 'silent'
    })

    try {
        const { html } = await server.ssrLoadModule(entry)
        return html
    } finally {
        await server.close()
    }
}

const rootImportHtml = await renderWithVite('/src/render-root.js', {
    configFile: false,
    plugins: [svelte()],
    resolve: {
        dedupe: ['svelte']
    }
})
assert.match(rootImportHtml, /<object\b[^>]*data-regression="object"/)
assert.match(rootImportHtml, /<set\b[^>]*data-regression="set"/)

const optimizedHtml = await renderWithVite('/src/render-optimized.js', {
    configFile: path.join(import.meta.dirname, 'vite.optimized.config.mjs')
})
assert.match(optimizedHtml, /<object\b[^>]*data-regression="optimized-object"/)
assert.match(optimizedHtml, /<set\b[^>]*data-regression="optimized-set"/)

/** Strips Svelte's hydration comments (`<!--[-->`, `<!--]-->`, …). */
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '')

/**
 * Server-renders a fixture with the plain consumer set-up.
 *
 * @param {string} entry The root-relative render module.
 * @returns {Promise<string>} The server-rendered HTML.
 */
const renderPlain = (entry) =>
    renderWithVite(entry, {
        configFile: false,
        plugins: [svelte()],
        resolve: { dedupe: ['svelte'] }
    })

// Port of Motion 14.7.1 `Reorder/__tests__/server.ssr.test.tsx` (#2232): the
// `./m` entry's Reorder renders the same server markup as the main one.
const reorderHtml = await renderPlain('/src/render-reorder-ssr.js')
const reorderMHtml = await renderPlain('/src/render-reorder-m-ssr.js')
assert.match(reorderHtml, /<article\b/)
assert.match(reorderHtml, /<main\b/)
assert.ok(reorderHtml.includes('overflow-anchor: none'), reorderHtml)
assert.ok(reorderMHtml.includes('overflow-anchor: none'), reorderMHtml)
assert.equal(stripComments(reorderMHtml), stripComments(reorderHtml))

// The `m` kind wrapper must not change server output, and its internal props
// must never reach the markup.
const kindHtml = await renderPlain('/src/render-kind-ssr.js')
const kindMatch = stripComments(kindHtml)
    .trim()
    .match(/^<div data-kind="motion">([\s\S]*)<\/div>\s*<div data-kind="m">([\s\S]*)<\/div>$/)
assert.ok(kindMatch, `KindSsr markup has no data-kind wrappers: ${kindHtml}`)
const [, motionInner, mInner] = kindMatch
assert.match(motionInner, /<div\b[^>]*class="box"/)
assert.equal(mInner, motionInner)
for (const html of [kindHtml, reorderHtml, reorderMHtml]) {
    for (const name of ['__motionKind', 'ignoreStrict', 'ignorestrict']) {
        assert.ok(!html.includes(name), `${name} leaked into server markup: ${html}`)
    }
}

console.log('Vite 6 consumer SSR regression checks passed.')
