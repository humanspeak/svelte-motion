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

// Featureless `m` (plan 016). No component has a VisualElement on the server
// (Motion 14.7.1 `motion/index.tsx`), so a bare `m`, an `m` inside a sync or an
// async LazyMotion and a `motion` with the same props render the same markup.
// The one exception is svelte-motion's auto optimized-appear extension (upstream
// needs an explicit `startOptimizedAppearAnimation`): a featureless `m` has no
// node to hand the appear animation off to, so it emits neither the
// `data-framer-appear-id` attribute nor the appear `<script>`. Compare with both
// removed. The appear script always starts `<script>(()=>{const p=`
// (`src/lib/utils/optimizedAppear.ts`); any other `<script>` is kept on purpose.
const stripAppear = (html) =>
    html
        .replace(/\sdata-framer-appear-id="[^"]*"/g, '')
        .replace(/<script>\(\(\)=>\{const p=[\s\S]*?<\/script>/g, '')

const featurelessHtml = stripComments(await renderPlain('/src/render-featureless-ssr.js')).trim()
/** @type {Record<string, string>} */
const kinds = {}
for (const [, kind, inner] of featurelessHtml.matchAll(
    /<div data-kind="([^"]+)">([\s\S]*?)<\/div>\s*(?=<div data-kind=|$)/g
)) {
    kinds[kind] = inner
}
for (const kind of ['m-bare', 'm-lazy', 'motion', 'm-async', 'm-path', 'motion-path']) {
    assert.ok(
        kinds[kind] !== undefined,
        `FeaturelessSsr has no ${kind} wrapper: ${featurelessHtml}`
    )
}
assert.match(kinds.motion, /<div\b[^>]*data-testid="box"/)

// S4: the normaliser keeps real markup differences.
assert.notEqual(
    stripAppear(kinds.motion),
    stripAppear(kinds.motion.replace('width: 10px', 'width: 11px'))
)
assert.notEqual(stripAppear('<div a="1"></div>'), stripAppear('<div a="2"></div>'))

// S1: a featureless `m` emits no optimized-appear attribute or script.
for (const kind of ['m-bare', 'm-async']) {
    assert.ok(!kinds[kind].includes('data-framer-appear-id'), `${kind}: ${kinds[kind]}`)
    assert.ok(!kinds[kind].includes('<script'), `${kind}: ${kinds[kind]}`)
}

// S2: featured elements keep the auto optimized appear.
for (const kind of ['motion', 'm-lazy']) {
    assert.ok(kinds[kind].includes('data-framer-appear-id'), `${kind}: ${kinds[kind]}`)
    assert.ok(kinds[kind].includes('<script>(()=>{const p='), `${kind}: ${kinds[kind]}`)
}

// S5: the `pathLength` visibility hold is for elements that will animate it
// (upstream has no hold; a featureless `m.path` must stay painted).
assert.doesNotMatch(kinds['m-path'], /visibility:\s*hidden/, 'm-path')
assert.match(kinds['motion-path'], /visibility:\s*hidden/, 'motion-path')

// S3: apart from optimized appear, the markup is identical.
for (const kind of ['m-bare', 'm-async', 'm-lazy']) {
    assert.equal(stripAppear(kinds[kind]), stripAppear(kinds.motion), kind)
}

// S6: `tabindex` comes from `onTap` / `onTapStart` / `whileTap` props, as
// upstream `render/html/use-props.ts:76-81`, also on the server, for buttons
// and for unresolved `whileTap` labels; `onTapCancel` is not in the list.
const tapHtml = stripComments(await renderPlain('/src/render-tap-ssr.js'))
/** @param {string} testId */
const tapTag = (testId) => {
    const match = tapHtml.match(new RegExp(`<[a-z]+\\b[^>]*data-testid="${testId}"[^>]*>`))
    assert.ok(match, `TapSsr has no ${testId}: ${tapHtml}`)
    return match[0]
}
for (const testId of ['on-tap', 'on-tap-start', 'tap-label', 'tap-button']) {
    assert.match(tapTag(testId), /\stabindex="0"/, testId)
}
assert.doesNotMatch(tapTag('on-tap-cancel'), /\stabindex=/)

console.log('Vite 6 consumer SSR regression checks passed.')
