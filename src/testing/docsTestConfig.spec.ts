import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const docsRoot = join(repoRoot, 'docs')
const docsConfigPath = join(docsRoot, 'vite.config.ts')

const writerPlugins = ['docs-kit:doc-mirrors', 'docs-kit:llms-full']

type ProjectSummary = {
    extends?: string
    test?: {
        name?: string
        environment?: string
        include?: string[]
        exclude?: string[]
        setupFiles?: string[]
        browser?: { enabled?: boolean; providerName?: string; instances?: unknown[] }
    }
}

type ConfigSummary = {
    plugins: string[]
    projects: ProjectSummary[]
    expectRequireAssertions?: boolean
}

/** `VITEST` values exercised in the child; `null` means the variable is unset. */
const modes = { unset: null, true: 'true', false: 'false' } as const
type Mode = keyof typeof modes

/**
 * Imports the actual docs Vite config in a fresh Node process once per
 * `VITEST` mode and summarizes its plugins and Vitest projects.
 *
 * The outer Vitest worker exports `VITEST` and related variables, so every
 * `VITEST*` variable is stripped from the child's environment before it
 * starts. The child then sets (or deletes) `VITEST` explicitly before each
 * import; a distinct query string gives every mode its own evaluation of the
 * real config module. Loading the config costs several seconds, so all modes
 * share one child. Nested arrays and promises (for example `sveltekit()`) are
 * flattened so the real registered plugin names are reported. No server is
 * started.
 *
 * @returns The plugin names in registration order and the project settings per mode.
 */
const loadDocsConfigs = (): Record<Mode, ConfigSummary> => {
    const script = `
        const flatten = async (entry) => {
            const resolved = await entry
            if (Array.isArray(resolved)) return (await Promise.all(resolved.map(flatten))).flat()
            return resolved ? [resolved] : []
        }
        const summaries = {}
        for (const [mode, value] of Object.entries(${JSON.stringify(modes)})) {
            if (value === null) delete process.env.VITEST
            else process.env.VITEST = value
            const { default: config } = await import(${JSON.stringify(docsConfigPath)} + '?mode=' + mode)
            const plugins = await flatten(config.plugins)
            summaries[mode] = {
                plugins: plugins.map((plugin) => plugin.name),
                projects: (config.test?.projects ?? []).map((project) => ({
                    extends: project.extends,
                    test: {
                        name: project.test?.name,
                        environment: project.test?.environment,
                        include: project.test?.include,
                        exclude: project.test?.exclude,
                        setupFiles: project.test?.setupFiles,
                        browser: project.test?.browser && {
                            enabled: project.test.browser.enabled,
                            providerName: project.test.browser.provider?.name,
                            instances: project.test.browser.instances
                        }
                    }
                })),
                expectRequireAssertions: config.test?.expect?.requireAssertions
            }
        }
        console.log('CONFIG_SUMMARY=' + JSON.stringify(summaries))
    `
    const env: NodeJS.ProcessEnv = { ...process.env }
    for (const key of Object.keys(env)) {
        if (key === 'VITEST' || key.startsWith('VITEST_')) delete env[key]
    }

    const output = execFileSync(
        process.execPath,
        ['--import', 'tsx', '--input-type=module', '-e', script],
        { cwd: docsRoot, encoding: 'utf8', env }
    )
    const line = output.split('\n').find((candidate) => candidate.startsWith('CONFIG_SUMMARY='))
    if (!line) throw new Error(`Docs config child printed no summary:\n${output}`)
    return JSON.parse(line.slice('CONFIG_SUMMARY='.length)) as Record<Mode, ConfigSummary>
}

let configs: Record<Mode, ConfigSummary>

beforeAll(() => {
    configs = loadDocsConfigs()
})

describe('docs vite config plugin selection', () => {
    it('omits only the mirror and llms-full writers when VITEST is "true"', () => {
        const outside = configs.unset
        const underVitest = configs.true

        for (const name of writerPlugins) expect(underVitest.plugins).not.toContain(name)
        expect(underVitest.plugins).toEqual(
            outside.plugins.filter((name) => !writerPlugins.includes(name))
        )
    })

    it.each([
        ['unset', 'unset'],
        ['"false"', 'false']
    ] as const)('keeps both writers registered when VITEST is %s', (_label, mode) => {
        const { plugins } = configs[mode]

        for (const name of writerPlugins) expect(plugins).toContain(name)
        // docMirrorsPlugin must still precede llmsFullPlugin so llms-full reads fresh mirrors.
        expect(plugins.indexOf('docs-kit:doc-mirrors')).toBeLessThan(
            plugins.indexOf('docs-kit:llms-full')
        )
    })

    it('keeps the other docs-kit generators registered under Vitest', () => {
        const { plugins } = configs.true

        expect(plugins).toContain('docs-kit:sitemap-manifest')
        expect(plugins).toContain('docs-kit:demo-manifest')
        expect(plugins).toContain('docs-kit:example-mirrors')
        expect(plugins).toContain('docs-kit:llms')
    })

    it('leaves the client and server Vitest projects unchanged', () => {
        const underVitest = configs.true

        expect(underVitest.projects).toEqual(configs.unset.projects)
        expect(configs.false.projects).toEqual(configs.unset.projects)
        expect(underVitest.expectRequireAssertions).toBe(true)
        expect(underVitest.projects).toEqual([
            {
                extends: './vite.config.ts',
                test: {
                    name: 'client',
                    include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
                    exclude: ['src/lib/server/**'],
                    setupFiles: ['./vitest-setup-client.ts'],
                    browser: {
                        enabled: true,
                        providerName: 'playwright',
                        instances: [{ browser: 'chromium' }]
                    }
                }
            },
            {
                extends: './vite.config.ts',
                test: {
                    name: 'server',
                    environment: 'node',
                    include: ['src/**/*.{test,spec}.{js,ts}'],
                    exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
                }
            }
        ])
    })
})
