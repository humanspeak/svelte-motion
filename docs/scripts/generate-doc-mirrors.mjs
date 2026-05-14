// Per-doc .md mirrors for LLM citation surfaces.
//
// Walks `src/routes/docs/**/+page.svx`, parses frontmatter, strips Svelte
// `<script>` blocks and component tags, and writes clean markdown to
// `static/docs/<slug>.md`. The result is served verbatim at
// `https://motion.svelte.page/docs/<slug>.md` — the dominant citation surface
// for ChatGPT, Perplexity, and other LLM crawlers (Tailwind / shadcn / Astro
// all ship the same pattern).
//
// Run via `pnpm doc-mirrors` or automatically through the `build` script.

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve as resolvePath } from 'node:path'

const ROOT = resolvePath(process.cwd(), 'src', 'routes', 'docs')
const OUT_DIR = resolvePath(process.cwd(), 'static', 'docs')
const SITE_URL = 'https://motion.svelte.page'

/** Recursively find every `+page.svx` under /docs. */
async function findSvxFiles(dir, out = []) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const e of entries) {
        const full = join(dir, e.name)
        if (e.isDirectory()) {
            await findSvxFiles(full, out)
        } else if (e.name === '+page.svx') {
            out.push(full)
        }
    }
    return out
}

/** Map a `+page.svx` path to its public route slug. */
function toSlug(file) {
    const rel = file.replace(ROOT, '').replace(/\/?\+page\.svx$/i, '')
    if (rel === '' || rel === '/') return '_index'
    return rel.replace(/^\/+/, '').replace(/\//g, '-')
}

/** Parse YAML-ish frontmatter (title + description). Minimal — no full YAML. */
function parseFrontmatter(src) {
    const match = src.match(/^---\n([\s\S]*?)\n---\n?/)
    if (!match) return { rest: src, fm: {} }
    const body = match[1]
    const fm = {}
    for (const line of body.split('\n')) {
        const m = line.match(/^(\w+):\s*(.*?)\s*$/)
        if (!m) continue
        let value = m[2]
        // Strip surrounding quotes
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1)
        }
        fm[m[1]] = value
    }
    return { rest: src.slice(match[0].length), fm }
}

/**
 * Strip Svelte-specific syntax from .svx body so the result reads as clean
 * markdown. Fenced code blocks are preserved verbatim — only prose is
 * processed.
 *
 *   - Remove `<script>...</script>` blocks entirely.
 *   - Replace `<Example exampleUrl="X">…</Example>` with a "Live example: X"
 *     marker so the link is preserved.
 *   - Drop other component tags (uppercase or namespaced), keeping their
 *     children inline.
 *   - Collapse runs of blank lines to at most two.
 */
function stripSvelte(body) {
    // Split body into alternating prose / fenced-code segments so we can
    // process only prose. ```lang ... ``` (or ~~~) blocks are left untouched.
    const segments = []
    const fenceRe = /^(```|~~~)[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm
    let lastIndex = 0
    let m
    while ((m = fenceRe.exec(body)) !== null) {
        if (m.index > lastIndex) {
            segments.push({ kind: 'prose', text: body.slice(lastIndex, m.index) })
        }
        segments.push({ kind: 'code', text: m[0] })
        lastIndex = m.index + m[0].length
    }
    if (lastIndex < body.length) {
        segments.push({ kind: 'prose', text: body.slice(lastIndex) })
    }

    const processProse = (text) => {
        let out = text

        // Strip <script> blocks (including <script lang="ts">).
        out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>\s*/gi, '')

        // <Example exampleUrl="/examples/x" …>…</Example> → marker link.
        out = out.replace(/<Example\b([^>]*)>[\s\S]*?<\/Example>/g, (_match, attrs) => {
            const urlMatch = attrs.match(/exampleUrl=["']([^"']+)["']/)
            if (urlMatch) {
                return `\n> Live example: [${urlMatch[1]}](${SITE_URL}${urlMatch[1]})\n`
            }
            return ''
        })

        // Self-closing component tags: <SomeComponent ... /> → drop.
        out = out.replace(/<([A-Z][\w.]*)\b[^>]*\/>\s*/g, '')

        // Paired component tags: <SomeComponent>...</SomeComponent> → keep inner.
        // The backreference \1 ensures the closing tag matches the opening name.
        out = out.replace(
            /<([A-Z][\w.]*)\b[^>]*>([\s\S]*?)<\/\1>\s*/g,
            (...m) => m[2] // m[0] = full, m[1] = name, m[2] = inner
        )

        // Drop any leftover single-line component opens/closes.
        out = out.replace(/^<\/?[A-Z][\w.]*\b[^>]*>\s*$/gm, '')

        return out
    }

    let merged = segments.map((s) => (s.kind === 'prose' ? processProse(s.text) : s.text)).join('')

    // Collapse 3+ blank lines to 2.
    merged = merged.replace(/\n{3,}/g, '\n\n')
    return merged.trim() + '\n'
}

/** Build the final `.md` body for one doc page. */
function buildMarkdown({ slug, fm, body, routePath }) {
    const title = fm.title || slug.replace(/-/g, ' ')
    const description = fm.description || ''

    // Strip a leading H1 from the body if it matches the frontmatter title, so
    // we don't render the same headline twice.
    let cleanedBody = stripSvelte(body)
    const leadingH1 = cleanedBody.match(/^#\s+(.+?)\s*\n/)
    if (leadingH1 && leadingH1[1].trim().toLowerCase() === title.trim().toLowerCase()) {
        cleanedBody = cleanedBody.slice(leadingH1[0].length).trimStart()
    }

    const headerLines = [`<!-- Source: ${SITE_URL}${routePath} -->`, '', `# ${title}`, '']
    if (description) {
        headerLines.push(`> ${description}`, '')
    }
    headerLines.push(
        `**Source:** [${SITE_URL}${routePath}](${SITE_URL}${routePath})`,
        '',
        '---',
        ''
    )

    return headerLines.join('\n') + '\n' + cleanedBody
}

async function main() {
    const files = await findSvxFiles(ROOT)

    // Wipe then recreate to avoid stale slugs lingering after a doc removal.
    await rm(OUT_DIR, { recursive: true, force: true })
    await mkdir(OUT_DIR, { recursive: true })

    let written = 0
    for (const file of files) {
        const slug = toSlug(file)
        const raw = await readFile(file, 'utf8')
        const { fm, rest } = parseFrontmatter(raw)
        const routePath =
            slug === '_index'
                ? '/docs'
                : `/docs/${file
                      .replace(ROOT, '')
                      .replace(/\/?\+page\.svx$/i, '')
                      .replace(/^\/+/, '')}`
        const outName = slug === '_index' ? 'index.md' : `${slug}.md`
        const outPath = join(OUT_DIR, outName)
        await mkdir(dirname(outPath), { recursive: true })
        await writeFile(outPath, buildMarkdown({ slug, fm, body: rest, routePath }), 'utf8')
        written++
    }

    console.log(`Wrote ${written} doc mirror(s) to ${OUT_DIR}`)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
