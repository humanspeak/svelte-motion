import { svelte } from '@sveltejs/vite-plugin-svelte'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'

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

console.log('Vite 6 consumer SSR regression checks passed.')
