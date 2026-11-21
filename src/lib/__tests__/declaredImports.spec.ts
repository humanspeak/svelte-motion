import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Every package that shipped code imports at runtime must be declared in
 * `dependencies` or `peerDependencies`. A package that only resolves because a
 * dependency of ours (or of Svelte) happens to be hoisted breaks under strict
 * resolution (Yarn Plug'n'Play, pnpm with `hoist=false`). "Shipped" mirrors the
 * `files` exclusions in `package.json`: no `__tests__`, `*.spec.*` or `*.test.*`.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
}
const libDir = join(root, 'src', 'lib')

/** Removes block, line and HTML comments so JSDoc `@example` imports do not count. */
const stripComments = (source: string): string =>
    source
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:\\])\/\/.*$/gm, '$1')

/** True when a named-binding clause such as `{ type A, type B }` only holds types. */
const onlyTypeMembers = (clause: string): boolean => {
    const braces = clause.trim().match(/^\{([\s\S]*)\}$/)
    if (!braces) return false
    const members = braces[1]
        .split(',')
        .map((member) => member.trim())
        .filter(Boolean)
    return members.length > 0 && members.every((member) => /^type\s/.test(member))
}

/** A specifier is bare when it names a package rather than a path or alias. */
const isBare = (specifier: string): boolean => !/^(\.|\/|\$|node:)/.test(specifier)

/** `svelte/reactivity` → `svelte`, `@scope/name/sub` → `@scope/name`. */
const packageName = (specifier: string): string => {
    const parts = specifier.split('/')
    return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

/** Package names of every bare runtime (non-type) import in `source`. */
const runtimeImports = (source: string): string[] => {
    const code = stripComments(source)
    const specifiers: string[] = []
    // Static forms must open a statement, so a string such as
    // `'import it from "pkg"'` is not mistaken for an import.
    const fromClause = /^\s*(import|export)\s+(type\s+)?([^'"`;]*?)\s*from\s*['"]([^'"]+)['"]/gm
    for (const [, , typeKeyword, clause, specifier] of code.matchAll(fromClause)) {
        if (typeKeyword || onlyTypeMembers(clause)) continue
        specifiers.push(specifier)
    }
    for (const [, specifier] of code.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)) {
        specifiers.push(specifier)
    }
    for (const [, specifier] of code.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        specifiers.push(specifier)
    }
    return [...new Set(specifiers.filter(isBare).map(packageName))].sort()
}

/** Shipped source files under `dir`, skipping test files and `__tests__`. */
const shippedFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : shippedFiles(path)
        if (!/\.(ts|js|svelte)$/.test(entry.name)) return []
        if (/\.(spec|test)\./.test(entry.name)) return []
        return [path]
    })

describe('declared imports', () => {
    it('declares every package that shipped src/lib code imports at runtime', () => {
        const declared = new Set([
            ...Object.keys(pkg.dependencies ?? {}),
            ...Object.keys(pkg.peerDependencies ?? {})
        ])
        const firstImporter = new Map<string, string>()
        for (const file of shippedFiles(libDir).sort()) {
            for (const name of runtimeImports(readFileSync(file, 'utf8'))) {
                if (!firstImporter.has(name)) firstImporter.set(name, relative(root, file))
            }
        }
        const undeclared = [...firstImporter.keys()].filter((name) => !declared.has(name)).sort()
        const details = undeclared.map(
            (name) => `${name} (first imported by ${firstImporter.get(name)})`
        )
        expect(undeclared, `undeclared runtime imports: ${details.join(', ')}`).toEqual([])
    })

    it('scans only bare runtime imports and reduces them to package names', () => {
        const source = [
            '/**',
            ' * @example',
            " * import { motion } from '@humanspeak/svelte-motion'",
            ' */',
            "// import { gone } from 'line-comment'",
            '<!-- <script>import x from "html-comment"</script> -->',
            "import type { Plugin } from 'vite'",
            "import { type Page, type Kit } from '@sveltejs/kit'",
            "export type { Thing } from 'type-reexport'",
            "import { SvelteMap } from 'svelte/reactivity'",
            "import { a, type B } from 'mixed'",
            "import { thing } from '@scope/name/sub/path'",
            "import 'side-effect'",
            "export * from 'star-reexport'",
            "const lazy = () => import('lazy-pkg')",
            "import local from './local'",
            "import alias from '$lib/alias'",
            "import { readFileSync } from 'node:fs'",
            "const url = 'https://example.com'",
            'const hint = \'import it from "string-literal"\'',
            'import {',
            '    multi,',
            '    line',
            "} from 'multi-line'"
        ].join('\n')
        expect(runtimeImports(source)).toEqual([
            '@scope/name',
            'lazy-pkg',
            'mixed',
            'multi-line',
            'side-effect',
            'star-reexport',
            'svelte'
        ])
    })
})
