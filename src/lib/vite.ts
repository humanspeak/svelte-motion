import { Parser, type Node } from 'acorn'
import type { Plugin } from 'vite'

/**
 * Tag-to-component name mapping. Each key is the lowercase HTML/SVG tag,
 * and the value is the PascalCase component filename (without .svelte).
 *
 * This is used by the Vite plugin to rewrite `motion.div` → `import Div from '…/Div.svelte'`.
 */
const toComponentName = (tag: string): string =>
    tag
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')

/** Set of valid HTML/SVG element names that have motion component wrappers. */
const VALID_TAGS = new Set([
    'a',
    'abbr',
    'address',
    'animate',
    'animatemotion',
    'animatetransform',
    'area',
    'article',
    'aside',
    'audio',
    'b',
    'base',
    'bdi',
    'bdo',
    'blockquote',
    'br',
    'button',
    'canvas',
    'caption',
    'circle',
    'cite',
    'clippath',
    'code',
    'col',
    'colgroup',
    'cursor',
    'data',
    'datalist',
    'dd',
    'defs',
    'del',
    'desc',
    'details',
    'dfn',
    'dialog',
    'div',
    'dl',
    'dt',
    'ellipse',
    'em',
    'embed',
    'feblend',
    'fecolormatrix',
    'fecomponenttransfer',
    'fecomposite',
    'feconvolvematrix',
    'fediffuselighting',
    'fedisplacementmap',
    'fedistantlight',
    'feflood',
    'fefunca',
    'fefuncb',
    'fefuncg',
    'fefuncr',
    'fegaussianblur',
    'feimage',
    'femerge',
    'femergenode',
    'femorphology',
    'feoffset',
    'fepointlight',
    'fespecularlighting',
    'fespotlight',
    'fetile',
    'feturbulence',
    'fieldset',
    'figcaption',
    'figure',
    'filter',
    'footer',
    'foreignobject',
    'form',
    'g',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hgroup',
    'hr',
    'i',
    'iframe',
    'image',
    'img',
    'input',
    'ins',
    'kbd',
    'label',
    'legend',
    'li',
    'line',
    'lineargradient',
    'main',
    'map',
    'mark',
    'marker',
    'mask',
    'math',
    'menu',
    'metadata',
    'meter',
    'mpath',
    'nav',
    'noscript',
    'object',
    'ol',
    'optgroup',
    'option',
    'output',
    'p',
    'path',
    'pattern',
    'picture',
    'polygon',
    'polyline',
    'pre',
    'progress',
    'q',
    'radialgradient',
    'rect',
    'rp',
    'rt',
    'ruby',
    's',
    'samp',
    'script',
    'search',
    'section',
    'select',
    'selectedcontent',
    'set',
    'slot',
    'small',
    'source',
    'span',
    'stop',
    'strong',
    'style',
    'sub',
    'summary',
    'sup',
    'svg',
    'switch',
    'symbol',
    'table',
    'tbody',
    'td',
    'template',
    'text',
    'textarea',
    'textpath',
    'tfoot',
    'th',
    'thead',
    'time',
    'title',
    'tr',
    'track',
    'tref',
    'tspan',
    'u',
    'ul',
    'use',
    'var',
    'video',
    'view',
    'wbr'
])

/**
 * Regex to match import of `motion` from the library.
 *
 * Handles:
 *   import { motion } from '@humanspeak/svelte-motion'
 *   import { motion, animate } from '@humanspeak/svelte-motion'
 *   import { animate, motion } from '@humanspeak/svelte-motion'
 */
const MOTION_IMPORT_RE =
    /import\s*\{([^}]*\bmotion\b[^}]*)\}\s*from\s*['"]@humanspeak\/svelte-motion['"]/

/**
 * Regex to find `motion.TAG` usage in templates (opening tags and self-closing).
 *
 * Matches: `<motion.div`, `<motion.span`, `<motion.circle`, etc.
 */
const MOTION_TEMPLATE_OPEN_RE = /<motion\.([a-z][a-z0-9-]*)/g

/**
 * Regex to find closing tags: `</motion.TAG>`
 */
const MOTION_TEMPLATE_CLOSE_RE = /<\/motion\.([a-z][a-z0-9-]*)\s*>/g

/**
 * Regex to find `motion.TAG` usage in script blocks (JS expressions).
 *
 * Matches property access like `motion.div` but NOT inside strings or comments.
 * Uses a simple word-boundary approach.
 */
const MOTION_SCRIPT_RE = /\bmotion\.([a-z][a-z0-9-]*)\b/g

/**
 * A Vite plugin that optimizes `@humanspeak/svelte-motion` imports for tree-shaking.
 *
 * Transforms `motion.div`, `motion.span`, etc. into direct component imports,
 * eliminating the need to bundle all 170+ HTML/SVG element wrappers.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { svelteMotionOptimize } from '@humanspeak/svelte-motion/vite'
 * import { sveltekit } from '@sveltejs/kit/vite'
 * import { defineConfig } from 'vite'
 *
 * export default defineConfig({
 *     plugins: [svelteMotionOptimize(), sveltekit()]
 * })
 * ```
 *
 * Before (all 170+ wrappers bundled):
 * ```svelte
 * <script>
 *     import { motion } from '@humanspeak/svelte-motion'
 * </script>
 * <motion.div animate={{ opacity: 1 }}>Hello</motion.div>
 * ```
 *
 * After (only Div.svelte bundled):
 * ```svelte
 * <script>
 *     import SvelteMotionDiv from '@humanspeak/svelte-motion/html/Div.svelte'
 * </script>
 * <SvelteMotionDiv animate={{ opacity: 1 }}>Hello</SvelteMotionDiv>
 * ```
 */
export const svelteMotionOptimize = (): Plugin => ({
    name: 'svelte-motion-optimize',
    enforce: 'pre',

    transform(code: string, id: string) {
        // Only process .svelte files that import motion (skip node_modules)
        if (!id.endsWith('.svelte')) return null
        if (id.includes('node_modules')) return null
        if (!code.includes('@humanspeak/svelte-motion')) return null

        const importMatch = MOTION_IMPORT_RE.exec(code)
        if (!importMatch) return null

        // Collect all motion.TAG usages (both template and script)
        const usedTags = new Set<string>()

        // Scan template for <motion.TAG (closing tags always pair with an opening tag)
        let match: RegExpExecArray | null
        MOTION_TEMPLATE_OPEN_RE.lastIndex = 0
        while ((match = MOTION_TEMPLATE_OPEN_RE.exec(code)) !== null) {
            if (VALID_TAGS.has(match[1])) usedTags.add(match[1])
        }

        // Scan script blocks for motion.TAG in JS expressions
        // Only match inside <script> tags to avoid false positives in comments/text
        const scriptBlockRe = /<script[^>]*>([\s\S]*?)<\/script>/g
        let scriptMatch: RegExpExecArray | null
        while ((scriptMatch = scriptBlockRe.exec(code)) !== null) {
            const scriptContent = scriptMatch[1]
            MOTION_SCRIPT_RE.lastIndex = 0
            while ((match = MOTION_SCRIPT_RE.exec(scriptContent)) !== null) {
                if (VALID_TAGS.has(match[1])) usedTags.add(match[1])
            }
        }

        if (usedTags.size === 0) return null

        let transformed = code

        // Build individual component imports
        const componentImports: string[] = []
        const tagToLocal = new Map<string, string>()

        for (const tag of usedTags) {
            const componentName = toComponentName(tag)
            const localName = `SvelteMotion${componentName}`
            tagToLocal.set(tag, localName)
            componentImports.push(
                `import ${localName} from '@humanspeak/svelte-motion/html/${componentName}.svelte'`
            )
        }

        // Check if motion is used for anything other than .TAG access
        // (e.g., passed as a variable, used in a function call)
        const otherImports = importMatch[1]
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s && s !== 'motion')

        // Check if motion itself is used beyond .TAG access
        // Remove all motion.TAG patterns and see if bare `motion` remains
        const codeWithoutTags = transformed
            .replace(MOTION_TEMPLATE_OPEN_RE, '')
            .replace(MOTION_TEMPLATE_CLOSE_RE, '')
            .replace(MOTION_SCRIPT_RE, '')
        const motionStillUsed = /\bmotion\b/.test(
            codeWithoutTags.replace(MOTION_IMPORT_RE, '').replace(/['"].*?['"]/g, '')
        )

        // Replace the import statement
        if (motionStillUsed) {
            // motion is still used as a value (e.g., passed to a function), keep the original import
            // Just add the individual imports alongside
            transformed = transformed.replace(
                MOTION_IMPORT_RE,
                (original) => `${original}\n${componentImports.join('\n')}`
            )
        } else if (otherImports.length > 0) {
            // Other named imports exist, keep those but remove motion
            transformed = transformed.replace(
                MOTION_IMPORT_RE,
                `import { ${otherImports.join(', ')} } from '@humanspeak/svelte-motion'\n${componentImports.join('\n')}`
            )
        } else {
            // Only motion was imported, replace entirely
            transformed = transformed.replace(MOTION_IMPORT_RE, componentImports.join('\n'))
        }

        // Replace template usage: <motion.TAG → <SvelteMotionTag, </motion.TAG> → </SvelteMotionTag>
        for (const [tag, localName] of tagToLocal) {
            const openRe = new RegExp(`<motion\\.${escapeRegExp(tag)}(?=[\\s/>])`, 'g')
            const closeRe = new RegExp(`</motion\\.${escapeRegExp(tag)}\\s*>`, 'g')

            transformed = transformed.replace(openRe, `<${localName}`)
            transformed = transformed.replace(closeRe, `</${localName}>`)
        }

        // Rewrite `motion.TAG` JS references (e.g. `const Component = motion.div`)
        // inside <script> blocks only. A naive regex over the script body would
        // also clobber the same substring in string literals (`"motion.div"`)
        // and comments (`// motion.div`). Parse the script as JS instead and
        // only rewrite real `motion.<tag>` MemberExpressions. For scripts that
        // fail to parse as plain JS (e.g. `<script lang="ts">`), fall back to a
        // string/comment-aware lexer that achieves the same correctness without
        // needing a TS parser.
        transformed = transformed.replace(
            /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g,
            (_full, open: string, content: string, close: string) =>
                open + rewriteMotionRefsInScript(content, tagToLocal) + close
        )

        return {
            code: transformed,
            map: null
        }
    }
})

/**
 * Escapes special regex characters in a string.
 *
 * @param str - The string to escape.
 * @returns The escaped string safe for use in a RegExp.
 */
const escapeRegExp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Rewrite `motion.<tag>` member-expression references inside a `<script>`
 * body to the matching `SvelteMotionTag` local. Preserves string literals
 * and comments — they look like `motion.div` to a regex but must not be
 * rewritten.
 *
 * Strategy: parse the body as JS with acorn and splice only real
 * MemberExpression matches. If parsing fails (TypeScript, JSX, etc.) fall
 * back to a string/comment-aware lexer that skips literals and comments.
 *
 * @param content - Raw script body (between `<script ...>` and `</script>`).
 * @param tagToLocal - Map of lowercase tag → local component identifier.
 * @returns The rewritten body, ready to splice back into the source.
 */
const rewriteMotionRefsInScript = (content: string, tagToLocal: Map<string, string>): string => {
    try {
        return rewriteViaAst(content, tagToLocal)
    } catch {
        return rewriteViaLexer(content, tagToLocal)
    }
}

interface AcornIdentifier extends Node {
    type: 'Identifier'
    name: string
}

interface AcornMemberExpression extends Node {
    type: 'MemberExpression'
    object: Node
    property: Node
    computed: boolean
}

const isIdentifier = (n: Node | undefined | null): n is AcornIdentifier =>
    !!n && n.type === 'Identifier'

const isMemberExpression = (n: Node | undefined | null): n is AcornMemberExpression =>
    !!n && n.type === 'MemberExpression'

/**
 * Walk an acorn AST and collect every `motion.<tag>` MemberExpression range
 * we should rewrite. Splice from end to start so earlier indices stay valid.
 */
const rewriteViaAst = (content: string, tagToLocal: Map<string, string>): string => {
    const ast = Parser.parse(content, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
        allowHashBang: true
    }) as Node

    const edits: Array<{ start: number; end: number; replacement: string }> = []

    const visit = (node: Node | null | undefined) => {
        if (!node || typeof node !== 'object' || typeof node.type !== 'string') return
        if (
            isMemberExpression(node) &&
            !node.computed &&
            isIdentifier(node.object) &&
            node.object.name === 'motion' &&
            isIdentifier(node.property)
        ) {
            const localName = tagToLocal.get(node.property.name)
            if (localName) {
                edits.push({ start: node.start, end: node.end, replacement: localName })
                return
            }
        }
        for (const key of Object.keys(node) as Array<keyof Node>) {
            if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue
            const value = (node as unknown as Record<string, unknown>)[key as string]
            if (Array.isArray(value)) value.forEach((v) => visit(v as Node))
            else if (value && typeof value === 'object') visit(value as Node)
        }
    }
    visit(ast)

    if (edits.length === 0) return content
    edits.sort((a, b) => b.start - a.start)
    let out = content
    for (const edit of edits) {
        out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end)
    }
    return out
}

/**
 * Fallback for scripts acorn can't parse (TS, JSX). Walks the source
 * character-by-character, skipping string literals (`'`, `"`, backtick incl.
 * `${…}` substitutions) and line/block comments, then applies a `motion.<tag>`
 * regex to the remaining "code" regions. Less precise than AST but covers
 * the same correctness contract for literal/comment preservation.
 */
const rewriteViaLexer = (content: string, tagToLocal: Map<string, string>): string => {
    const len = content.length
    const out: string[] = []
    let i = 0

    const isIdStart = (ch: string) => /[A-Za-z_$]/.test(ch)
    const isIdPart = (ch: string) => /[A-Za-z0-9_$-]/.test(ch)

    while (i < len) {
        const ch = content[i]
        const next = content[i + 1]

        // Line comment
        if (ch === '/' && next === '/') {
            const end = content.indexOf('\n', i)
            const stop = end === -1 ? len : end
            out.push(content.slice(i, stop))
            i = stop
            continue
        }
        // Block comment
        if (ch === '/' && next === '*') {
            const end = content.indexOf('*/', i + 2)
            const stop = end === -1 ? len : end + 2
            out.push(content.slice(i, stop))
            i = stop
            continue
        }
        // String literals (single/double)
        if (ch === '"' || ch === "'") {
            const quote = ch
            let j = i + 1
            while (j < len) {
                if (content[j] === '\\') {
                    j += 2
                    continue
                }
                if (content[j] === quote) {
                    j++
                    break
                }
                j++
            }
            out.push(content.slice(i, j))
            i = j
            continue
        }
        // Template literal — naive: skip to matching backtick, no `${…}` parsing
        // is needed for our use case (we only need to NOT rewrite the literal
        // text; substitutions still look like code but `motion.<tag>` inside
        // a template substitution is vanishingly rare and acorn would normally
        // handle it).
        if (ch === '`') {
            let j = i + 1
            while (j < len) {
                if (content[j] === '\\') {
                    j += 2
                    continue
                }
                if (content[j] === '`') {
                    j++
                    break
                }
                j++
            }
            out.push(content.slice(i, j))
            i = j
            continue
        }
        // Possible `motion.<tag>` identifier — require word boundary on left
        if (
            (i === 0 || !isIdPart(content[i - 1])) &&
            isIdStart(ch) &&
            content.slice(i, i + 7) === 'motion.'
        ) {
            let j = i + 7
            const tagStart = j
            while (j < len && isIdPart(content[j])) j++
            const tag = content.slice(tagStart, j)
            const localName = tagToLocal.get(tag)
            if (localName && (j === len || !isIdPart(content[j]))) {
                out.push(localName)
                i = j
                continue
            }
        }
        out.push(ch)
        i++
    }

    return out.join('')
}
