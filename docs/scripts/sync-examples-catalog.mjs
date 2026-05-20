import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve as resolvePath } from 'node:path'

/**
 * Sync the examples catalog object in `src/routes/examples/+page.ts` from
 * each individual `src/routes/examples/<slug>/+page.ts`'s `load()` return.
 *
 * Each example's `+page.ts` is the source of truth for its `title` and
 * (optional) `sourceUrl`; the catalog file just mirrors them into a
 * static record consumed by the examples landing page. Without this
 * sync a new example wouldn't surface in the catalog until someone
 * remembered to update the record by hand.
 *
 * Previously this script also emitted `src/lib/sitemap-manifest.json`.
 * That half now runs through docs-kit's `sitemapManifestPlugin` (wired
 * in `vite.config.ts`) and fires automatically on every `vite build`
 * and dev server boot — so this script is now exclusively about the
 * catalog rewrite.
 */

const ROOT = resolvePath(process.cwd(), 'src', 'routes')

/** Recursively find `+page.{svelte,svx,md}` files under a directory. */
async function findPageFiles(dir, out = []) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const e of entries) {
        const full = join(dir, e.name)
        if (e.isDirectory()) {
            await findPageFiles(full, out)
        } else if (/\+page\.(svelte|svx|md)$/i.test(e.name)) {
            out.push(full)
        }
    }
    return out
}

/** Convert a `+page` file path to a route path. */
function toRoutePath(file) {
    let p = file.replace(ROOT, '')
    p = p.replace(/\/\+page\.(svelte|svx|md)$/i, '')
    return p === '' ? '/' : p
}

/**
 * Load example metadata from an individual `+page.ts`.
 * @param {string} examplePath Absolute path to the example directory.
 * @returns {Promise<{ title: string, sourceUrl: string | null } | null>}
 */
async function loadExampleMetadata(examplePath) {
    try {
        const pageTs = join(examplePath, '+page.ts')
        const content = await readFile(pageTs, 'utf8')

        const titleMatch = content.match(/title:\s*['"`]([^'"`]+)['"`]/)
        const sourceUrlMatch = content.match(/sourceUrl:\s*['"`]([^'"`]+)['"`]/)

        if (titleMatch) {
            return {
                title: titleMatch[1],
                sourceUrl: sourceUrlMatch?.[1] || null
            }
        }
    } catch {
        // File doesn't exist or can't be read — fall through to the
        // slug-based fallback.
    }
    return null
}

/**
 * Lowercase multi-word phrases ("Animated Button" → "animated button")
 * so they read naturally mid-sentence; preserve identifier-style names
 * ("useAnimate", "AnimatePresence") so the public API names stay
 * correct.
 *
 * @param {string} title
 * @returns {string}
 */
function describable(title) {
    return /\s/.test(title) ? title.toLowerCase() : title
}

/**
 * Build the catalog description string. Deduplicates the trailing
 * "animation" token when the title already ends in one — without this
 * a slug like `shared-layout-animation` would produce the awkward
 * "Interactive shared layout animation animation example…".
 *
 * @param {string} title
 * @returns {string}
 */
function describeExample(title) {
    const phrase = describable(title)
    const stem = /\banimation\b\s*$/i.test(phrase) ? phrase : `${phrase} animation`
    return `Interactive ${stem} example using Svelte Motion.`
}

/**
 * Walk every `/examples/<slug>/` directory and build the catalog record.
 * @returns {Promise<Record<string, { title: string, description: string, sourceUrl: string | null }>>}
 */
async function generateExamplesMetadata(exampleRoutes) {
    const examples = {}

    for (const route of exampleRoutes) {
        const slug = route.replace('/examples/', '')
        const examplePath = join(ROOT, 'examples', slug)
        const metadata = await loadExampleMetadata(examplePath)

        if (metadata) {
            examples[slug] = {
                title: metadata.title,
                description: describeExample(metadata.title),
                sourceUrl: metadata.sourceUrl
            }
        } else {
            // Fallback: derive the title from the slug.
            const title = slug
                .split('-')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
            examples[slug] = {
                title,
                description: describeExample(title),
                sourceUrl: null
            }
        }
    }

    return examples
}

/**
 * Rewrite the `const examples = { … }` block in
 * `src/routes/examples/+page.ts` from the freshly-generated catalog.
 * @param {Record<string, object>} examples
 */
async function updateExamplesPageTs(examples) {
    const examplesPageTs = resolvePath(process.cwd(), 'src', 'routes', 'examples', '+page.ts')

    try {
        let content = await readFile(examplesPageTs, 'utf8')
        const examplesObjectRegex = /const examples\s*=\s*\{[\s\S]*?\n\s*\}(?=\s*\n\s*return)/

        // Format values as prettier-compatible JS (single quotes, no
        // trailing commas, no semicolons).
        const formatValue = (v) => (v === null ? 'null' : `'${v.replace(/'/g, "\\'")}'`)
        const lines = Object.entries(examples).map(([slug, meta]) => {
            const props = [
                `            title: ${formatValue(meta.title)}`,
                `            description: ${formatValue(meta.description)}`,
                `            sourceUrl: ${formatValue(meta.sourceUrl)}`
            ]
            // Quote keys that aren't valid identifiers (contain hyphens).
            const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(slug) ? slug : `'${slug}'`
            return `        ${key}: {\n${props.join(',\n')}\n        }`
        })
        const newExamplesObject = `const examples = {\n${lines.join(',\n')}\n    }`

        if (examplesObjectRegex.test(content)) {
            content = content.replace(examplesObjectRegex, newExamplesObject)
            await writeFile(examplesPageTs, content, 'utf8')
            console.log(`Updated examples metadata in ${examplesPageTs}`)
        } else {
            console.warn(`Could not find examples object pattern in ${examplesPageTs}`)
        }
    } catch (error) {
        console.warn(`Could not update examples page: ${error.message}`)
    }
}

async function main() {
    const files = await findPageFiles(ROOT)
    const exampleRoutes = files
        .map(toRoutePath)
        .filter((route) => route.startsWith('/examples/') && route !== '/examples')
        .sort()

    const examples = await generateExamplesMetadata(exampleRoutes)
    await updateExamplesPageTs(examples)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
