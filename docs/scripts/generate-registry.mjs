/**
 * generate-registry.mjs
 *
 * Reads component source files from docs/src/lib/shadcn/ui/ and generates
 * shadcn-svelte compatible registry JSON in docs/static/r/.
 *
 * Single source of truth: the live components used by the docs site.
 * This script rewrites internal imports for consumer compatibility and
 * inlines file contents into the registry-item JSON.
 *
 * Usage:
 *   node scripts/generate-registry.mjs
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join, resolve as resolvePath } from 'node:path'

// ─── Configuration ───────────────────────────────────────────────────────────

const DOCS_ROOT = resolvePath(process.cwd())
const UI_SOURCE_DIR = join(DOCS_ROOT, 'src', 'lib', 'shadcn', 'ui')
const OUTPUT_DIR = join(DOCS_ROOT, 'static', 'r')

const REGISTRY_NAME = 'svelte-motion'
const REGISTRY_HOMEPAGE = 'https://motion.svelte.page'
const REGISTRY_AUTHOR = 'Humanspeak, Inc.'

/**
 * Map from source directory name to registry item config.
 * Add new components here as they are created.
 */
const COMPONENT_MAP = {
    button: {
        name: 'animated-button',
        title: 'AnimatedButton',
        description:
            'Animated shadcn Button with spring-based press and hover via svelte-motion. Installs alongside the standard Button.',
        dependencies: ['@humanspeak/svelte-motion', 'tailwind-variants'],
        devDependencies: [],
        registryDependencies: [],
        categories: ['buttons'],
        docs: 'Requires @humanspeak/svelte-motion. Set animated={false} to disable motion.',
        /** Rename source files for the consumer (key = source filename, value = output filename) */
        fileRenames: {
            'button.svelte': 'animated-button.svelte',
            'index.ts': 'index.ts'
        }
    }
}

// ─── Import Rewriting ────────────────────────────────────────────────────────

/**
 * Rewrite internal import paths for consumer projects.
 *
 * @param {string} content - Raw file content
 * @param {string} sourceFilename - Original source filename
 * @param {Record<string, string>} fileRenames - Filename rename map
 * @param {string} pascalName - The PascalCase name for export rewriting (e.g. 'AnimatedButton')
 * @returns {string} Rewritten content
 */
function rewriteImports(content, sourceFilename, fileRenames, pascalName) {
    let result = content

    // Rewrite $lib/shadcn/utils → $UTILS$ (CLI resolves this to consumer's utils path)
    result = result.replace(/\$lib\/shadcn\/utils/g, '$UTILS$')

    // Rewrite relative imports to match renamed files
    // e.g. ./button.svelte → ./animated-button.svelte
    for (const [srcName, destName] of Object.entries(fileRenames)) {
        if (srcName !== destName) {
            result = result.replace(
                new RegExp(`\\./${srcName.replaceAll('.', '\\.')}`, 'g'),
                `./${destName}`
            )
        }
    }

    // Rewrite export names: Root as Button → Root as AnimatedButton
    if (sourceFilename === 'index.ts' && pascalName) {
        result = result.replace(/Root as Button/g, `Root as ${pascalName}`)
    }

    return result
}

// ─── File Discovery ──────────────────────────────────────────────────────────

/**
 * Read all component files from a source directory.
 *
 * @param {string} dirPath - Path to the component directory
 * @returns {Promise<Array<{filename: string, content: string}>>}
 */
async function readComponentFiles(dirPath) {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const files = []

    for (const entry of entries) {
        if (!entry.isFile()) continue
        const ext = extname(entry.name)
        if (!['.svelte', '.ts', '.js'].includes(ext)) continue

        const content = await readFile(join(dirPath, entry.name), 'utf8')
        files.push({ filename: entry.name, content })
    }

    return files
}

// ─── Registry Item Generation ────────────────────────────────────────────────

/**
 * Generate a registry-item.json object for a component.
 *
 * @param {string} sourceDirName - Source directory name (e.g. 'button')
 * @param {object} config - Component config from COMPONENT_MAP
 * @param {Array<{filename: string, content: string}>} sourceFiles - Raw source files
 * @returns {object} Registry item JSON object
 */
function generateRegistryItem(sourceDirName, config, sourceFiles) {
    const files = sourceFiles.map(({ filename, content }) => {
        const renamedFilename = config.fileRenames?.[filename] ?? filename
        const rewritten = rewriteImports(content, filename, config.fileRenames ?? {}, config.title)

        return {
            content: rewritten,
            type: 'registry:file',
            target: `${config.name}/${renamedFilename}`
        }
    })

    return {
        $schema: 'https://shadcn-svelte.com/schema/registry-item.json',
        name: config.name,
        type: 'registry:ui',
        title: config.title,
        description: config.description,
        dependencies: config.dependencies ?? [],
        devDependencies: config.devDependencies ?? [],
        registryDependencies: config.registryDependencies ?? [],
        files,
        categories: config.categories ?? [],
        author: REGISTRY_AUTHOR,
        docs: config.docs ?? ''
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    // Ensure output directory exists
    await mkdir(OUTPUT_DIR, { recursive: true })

    const registryItems = []

    // Process each configured component
    for (const [sourceDirName, config] of Object.entries(COMPONENT_MAP)) {
        const sourceDir = join(UI_SOURCE_DIR, sourceDirName)

        let sourceFiles
        try {
            sourceFiles = await readComponentFiles(sourceDir)
        } catch (err) {
            console.warn(`Skipping ${sourceDirName}: ${err.message}`)
            continue
        }

        if (sourceFiles.length === 0) {
            console.warn(`Skipping ${sourceDirName}: no source files found`)
            continue
        }

        // Generate and write the registry-item JSON
        const registryItem = generateRegistryItem(sourceDirName, config, sourceFiles)
        const itemPath = join(OUTPUT_DIR, `${config.name}.json`)
        await writeFile(itemPath, JSON.stringify(registryItem, null, 2) + '\n', 'utf8')
        console.log(`Generated ${itemPath}`)

        registryItems.push({
            name: config.name,
            type: 'registry:ui'
        })
    }

    // Generate top-level registry.json
    const registry = {
        $schema: 'https://shadcn-svelte.com/schema/registry.json',
        name: REGISTRY_NAME,
        homepage: REGISTRY_HOMEPAGE,
        items: registryItems
    }

    const registryPath = join(OUTPUT_DIR, 'registry.json')
    await writeFile(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8')
    console.log(`Generated ${registryPath}`)

    console.log(`\nRegistry generation complete: ${registryItems.length} item(s)`)
}

main().catch((err) => {
    console.error('Registry generation failed:', err)
    process.exit(1)
})
