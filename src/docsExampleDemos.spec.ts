import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Policy check for the docs example demos, run from the ROOT suite because
 * the docs package's own vitest config does not currently start (it sets
 * `test.environment: 'browser'`, which this vitest rejects), and CI only runs
 * the root suite.
 */
const DEMOS_ROOT = join(process.cwd(), 'docs/src/lib/examples')

/** `import … from '<relative path>'`, capturing the specifier. */
const RELATIVE_IMPORT = /^\s*import\s+(?:[^'"]*?from\s+)?['"](\.[^'"]*)['"]/gm

const collectDemos = (dir: string, found: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) collectDemos(path, found)
        else if (entry.endsWith('.svelte')) found.push(path)
    }
    return found
}

describe('docs example demos are self-contained', () => {
    const demos = collectDemos(DEMOS_ROOT)

    it('finds the demo files it is meant to police', () => {
        expect(demos.length).toBeGreaterThan(10)
    })

    it('imports nothing relative except sibling .svelte components', () => {
        // docs-kit's code-sample collector bundles a demo plus its sibling
        // `.svelte` files and nothing else, so that is exactly what the
        // published "complete source" on /examples/<slug> contains. A relative
        // import of any other module — a `.ts` helper, say — is emitted into
        // the sample verbatim while the file it points at is left behind:
        // readers copy the example and it fails to build, and whatever that
        // module taught is missing entirely. Inline such helpers into the demo.
        // Pre-existing, tracked separately: multi-state-badge shares a
        // `constants.ts` across six sibling components. Inlining it six times
        // would be worse than the bug; the real fix is for docs-kit's
        // collector to bundle non-`.svelte` siblings. Everything else must
        // stay self-contained.
        const KNOWN = 'examples/multi-state-badge/'
        const offenders: string[] = []

        for (const path of demos) {
            if (path.includes(KNOWN)) continue
            for (const [, specifier] of readFileSync(path, 'utf8').matchAll(RELATIVE_IMPORT)) {
                if (specifier.endsWith('.svelte')) continue
                offenders.push(`${path.replace(process.cwd() + '/', '')} → ${specifier}`)
            }
        }

        expect(
            offenders,
            `Relative non-.svelte imports are dropped from the published sample:\n  ${offenders.join('\n  ')}`
        ).toEqual([])
    })
})
