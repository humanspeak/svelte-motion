/**
 * Bundle-level guard for the tree-shaking guarantees documented in
 * `docs/src/routes/docs/tree-shaking/+page.svx`.
 *
 * Modeled on upstream Motion's
 * `packages/motion/src/__tests__/frameloop-tree-shaking.test.ts` (motion#3864):
 * bundle the published entry points through the package `exports` map and
 * assert that marker strings are present or absent.
 */
import { svelteMotionOptimize } from '@humanspeak/svelte-motion/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import assert from 'node:assert/strict'
import path from 'node:path'
import { build } from 'vite'

const PKG = '@humanspeak/svelte-motion'
const CONTAINER_MARKER = 'data-is-loaded'
const VIRTUAL_ID = 'virtual:tree-shaking-entry'
const RESOLVED_ID = '\0' + VIRTUAL_ID

/**
 * Whether the bundle contains a generated wrapper for the given element tag.
 *
 * @param {string} code Bundled output.
 * @param {string} tag Element tag, e.g. `circle`.
 * @returns {boolean} True when `tag: "<tag>"` is present.
 */
const hasTag = (code, tag) => new RegExp(`tag:\\s*"${tag}"`).test(code)

/**
 * Bundles an entry with Vite 6 (unminified, `svelte` external) and returns the
 * concatenated chunk code plus the entry chunk's export names.
 *
 * @param {string} entry Either module source code (virtual entry) or, when
 *   `file` is true, an absolute path to a real file entry.
 * @param {{ plugins?: import('vite').PluginOption[], file?: boolean }} [options]
 * @returns {Promise<{ code: string, exports: string[] }>} Bundle result.
 */
const bundle = async (entry, { plugins = [svelte()], file = false } = {}) => {
    const result = await build({
        root: import.meta.dirname,
        configFile: false,
        logLevel: 'silent',
        plugins: [
            {
                name: 'tree-shaking-entry',
                enforce: 'pre',
                resolveId: (id) => (!file && id === VIRTUAL_ID ? RESOLVED_ID : null),
                load: (id) => (!file && id === RESOLVED_ID ? entry : null)
            },
            ...plugins
        ],
        resolve: { dedupe: ['svelte'] },
        build: {
            write: false,
            minify: false,
            rollupOptions: {
                input: file ? entry : VIRTUAL_ID,
                preserveEntrySignatures: 'strict',
                external: [/^svelte($|\/)/]
            }
        }
    })
    const output = (Array.isArray(result) ? result[0] : result).output
    const chunks = output.filter((item) => item.type === 'chunk')
    return {
        code: chunks.map((chunk) => chunk.code).join('\n'),
        exports: chunks.find((chunk) => chunk.isEntry)?.exports ?? []
    }
}

/**
 * Relative size difference between two bundles.
 *
 * @param {string} a First bundle code.
 * @param {string} b Reference bundle code.
 * @returns {number} `|a - b| / b`.
 */
const relDiff = (a, b) => Math.abs(a.length - b.length) / b.length

// 1. Positive control: markers work.
const motionObject = await bundle(`import { motion } from '${PKG}'\nexport const Div = motion.div`)
assert.ok(
    hasTag(motionObject.code, 'circle') && hasTag(motionObject.code, 'blockquote'),
    'marker check is broken — the motion object bundle should contain every wrapper'
)

// 2. Named exports tree-shake.
const named = await bundle(`export { MotionDiv } from '${PKG}'`)
assert.ok(hasTag(named.code, 'div'), 'MotionDiv bundle should contain the div wrapper')
assert.ok(
    !hasTag(named.code, 'circle') && !hasTag(named.code, 'blockquote'),
    'docs promise broken: named exports (MotionDiv) must not pull in other element wrappers'
)

// 3. Direct imports tree-shake, and named exports match them.
const direct = await bundle(`export { default } from '${PKG}/html/Div.svelte'`)
assert.ok(
    !hasTag(direct.code, 'circle'),
    'docs promise broken: direct imports (html/Div.svelte) must not pull in other element wrappers'
)
assert.ok(
    relDiff(named.code, direct.code) < 0.01,
    'docs promise broken: named MotionDiv import should be within 1% of the direct Div.svelte import'
)

// 4. The Vite plugin tree-shakes.
const fixture = path.join(import.meta.dirname, 'src/TreeShakeOptimized.svelte')
const optimized = await bundle(fixture, {
    file: true,
    plugins: [svelteMotionOptimize(), svelte()]
})
assert.ok(
    !hasTag(optimized.code, 'circle'),
    'docs promise broken: svelteMotionOptimize() must not pull in unused element wrappers'
)
assert.ok(
    relDiff(optimized.code, direct.code) < 0.01,
    'docs promise broken: svelteMotionOptimize() bundle should be within 1% of the direct import'
)
const unoptimized = await bundle(fixture, { file: true, plugins: [svelte()] })
assert.ok(
    hasTag(unoptimized.code, 'circle'),
    'control broken — without the plugin, <motion.div> should bundle every wrapper'
)

// 5. The non-component surface never pulls in the component layer.
const all = await bundle(`export * from '${PKG}'`)
const COMPONENT_NAMES = new Set([
    'motion',
    'm',
    'Reorder',
    'AnimatePresence',
    'LayoutGroup',
    'LazyMotion',
    'MotionConfig',
    'PresenceChild'
])
const NON_COMPONENT_MOTION = new Set(['MotionGlobalConfig', 'MotionValueState'])
const isComponent = (name) =>
    COMPONENT_NAMES.has(name) || (/^Motion[A-Z]/.test(name) && !NON_COMPONENT_MOTION.has(name))
const nonComponent = all.exports.filter((name) => !isComponent(name))
for (const name of ['animate', 'frame', 'useTransform', 'useScroll']) {
    assert.ok(nonComponent.includes(name), `export derivation broke: ${name} not found`)
}
assert.ok(
    nonComponent.length >= 50,
    `export derivation broke: only ${nonComponent.length} non-component exports`
)

const surface = await bundle(`export { ${nonComponent.join(', ')} } from '${PKG}'`)
if (surface.code.includes(CONTAINER_MARKER) || hasTag(surface.code, 'div')) {
    const offenders = []
    for (const name of nonComponent) {
        const single = await bundle(`export { ${name} } from '${PKG}'`)
        if (single.code.includes(CONTAINER_MARKER) || hasTag(single.code, 'div')) {
            offenders.push(name)
        }
    }
    assert.fail(
        `these exports pull in the motion component layer: ${offenders.join(', ') || '(only in combination)'}`
    )
}

console.log('Tree-shaking consumer checks passed.')
