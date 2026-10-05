import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveChromiumLaunchOptions } from '../../scripts/chromium-launch-options'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const docsConfigPath = join(repoRoot, 'docs', 'playwright.config.ts')
const missingPinnedPath = '/nonexistent/pinned-chromium/chrome'

vi.mock('@playwright/test', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@playwright/test')>()
    return {
        ...actual,
        chromium: { executablePath: () => missingPinnedPath }
    }
})

type ProjectConfig = { name?: string; use?: { launchOptions?: { executablePath?: string } } }

const explicitVariable = 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'
const isRoot = process.getuid?.() === 0

let sandbox: string
let executable: string

/** Creates a file in the sandbox with the given mode. */
const createFile = (name: string, mode: number): string => {
    const path = join(sandbox, name)
    writeFileSync(path, '#!/bin/sh\n')
    chmodSync(path, mode)
    return path
}

/** Pretends to run on another platform for the duration of a test. */
const stubPlatform = (platform: NodeJS.Platform) => {
    const original = Object.getOwnPropertyDescriptor(process, 'platform')!
    Object.defineProperty(process, 'platform', { ...original, value: platform })
    return () => Object.defineProperty(process, 'platform', original)
}

beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'chromium-launch-options-'))
    executable = createFile('chrome', 0o755)
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.resetModules()
    rmSync(sandbox, { recursive: true, force: true })
})

describe('resolveChromiumLaunchOptions', () => {
    it('returns no options when the pinned executable exists, ignoring invalid fallbacks', () => {
        const options = resolveChromiumLaunchOptions(executable, {
            [explicitVariable]: join(sandbox, 'missing')
        })

        expect(options).toEqual({})
    })

    it('uses the explicit executable when the pinned browser is missing', () => {
        const options = resolveChromiumLaunchOptions(missingPinnedPath, {
            [explicitVariable]: executable
        })

        expect(options).toEqual({ executablePath: executable })
    })

    it('trims whitespace around the explicit executable path', () => {
        const options = resolveChromiumLaunchOptions(missingPinnedPath, {
            [explicitVariable]: `  ${executable}\n`
        })

        expect(options).toEqual({ executablePath: executable })
    })

    it('prefers the explicit executable over the browsers-root candidate', () => {
        const browsersRoot = join(sandbox, 'browsers')
        mkdirSync(browsersRoot)
        const candidate = join(browsersRoot, 'chromium')
        writeFileSync(candidate, '#!/bin/sh\n')
        chmodSync(candidate, 0o755)

        const options = resolveChromiumLaunchOptions(missingPinnedPath, {
            [explicitVariable]: executable,
            PLAYWRIGHT_BROWSERS_PATH: browsersRoot
        })

        expect(options).toEqual({ executablePath: executable })
    })

    it.each([
        ['a missing path', () => join(sandbox, 'missing')],
        ['a directory', () => sandbox]
    ])('throws actionable guidance for %s', (_label, getPath) => {
        const path = getPath()

        expect(() =>
            resolveChromiumLaunchOptions(missingPinnedPath, { [explicitVariable]: path })
        ).toThrowError(
            new RegExp(
                `${explicitVariable}.*${path.replace(/\W/g, '.')}[\\s\\S]*playwright install`
            )
        )
    })

    it.skipIf(process.platform === 'win32')(
        'throws for an explicit file without the execute bit on POSIX',
        () => {
            const nonExecutable = createFile('not-executable', 0o644)

            expect(() =>
                resolveChromiumLaunchOptions(missingPinnedPath, {
                    [explicitVariable]: nonExecutable
                })
            ).toThrowError(explicitVariable)
        }
    )

    it('never falls back to the browsers root when the explicit path is invalid', () => {
        const browsersRoot = join(sandbox, 'browsers')
        mkdirSync(browsersRoot)
        const candidate = join(browsersRoot, 'chromium')
        writeFileSync(candidate, '#!/bin/sh\n')
        chmodSync(candidate, 0o755)

        expect(() =>
            resolveChromiumLaunchOptions(missingPinnedPath, {
                [explicitVariable]: join(sandbox, 'missing'),
                PLAYWRIGHT_BROWSERS_PATH: browsersRoot
            })
        ).toThrowError(explicitVariable)
    })

    it('uses <PLAYWRIGHT_BROWSERS_PATH>/chromium when it is a runnable regular file', () => {
        const browsersRoot = join(sandbox, 'browsers')
        mkdirSync(browsersRoot)
        const candidate = join(browsersRoot, 'chromium')
        writeFileSync(candidate, '#!/bin/sh\n')
        chmodSync(candidate, 0o755)

        const options = resolveChromiumLaunchOptions(missingPinnedPath, {
            PLAYWRIGHT_BROWSERS_PATH: browsersRoot
        })

        expect(options).toEqual({ executablePath: candidate })
    })

    it('ignores an ordinary Playwright cache directory without that executable', () => {
        const cache = join(sandbox, 'ms-playwright')
        mkdirSync(join(cache, 'chromium-1234', 'chrome-linux'), { recursive: true })

        const options = resolveChromiumLaunchOptions(missingPinnedPath, {
            PLAYWRIGHT_BROWSERS_PATH: cache
        })

        expect(options).toEqual({})
    })

    it('ignores a browsers-root candidate that is a directory', () => {
        const browsersRoot = join(sandbox, 'browsers')
        mkdirSync(join(browsersRoot, 'chromium'), { recursive: true })

        const options = resolveChromiumLaunchOptions(missingPinnedPath, {
            PLAYWRIGHT_BROWSERS_PATH: browsersRoot
        })

        expect(options).toEqual({})
    })

    it("ignores Playwright's '0' browsers-path sentinel", () => {
        mkdirSync(join(sandbox, '0'))
        writeFileSync(join(sandbox, '0', 'chromium'), '#!/bin/sh\n')
        chmodSync(join(sandbox, '0', 'chromium'), 0o755)
        const originalCwd = process.cwd()
        process.chdir(sandbox)

        try {
            const options = resolveChromiumLaunchOptions(missingPinnedPath, {
                PLAYWRIGHT_BROWSERS_PATH: '0'
            })

            expect(options).toEqual({})
        } finally {
            process.chdir(originalCwd)
        }
    })

    it.each([
        ['unset', undefined],
        ['empty', ''],
        ['whitespace-only', '  \t\n']
    ])('treats %s variables as unset', (_label, value) => {
        const options = resolveChromiumLaunchOptions(missingPinnedPath, {
            [explicitVariable]: value,
            PLAYWRIGHT_BROWSERS_PATH: value
        })

        expect(options).toEqual({})
    })

    it('returns no options when nothing is configured', () => {
        expect(resolveChromiumLaunchOptions(missingPinnedPath, {})).toEqual({})
    })

    it('defaults to process.env', () => {
        vi.stubEnv(explicitVariable, executable)

        expect(resolveChromiumLaunchOptions(missingPinnedPath)).toEqual({
            executablePath: executable
        })
    })

    describe('on Windows', () => {
        let restorePlatform: () => void

        beforeEach(() => {
            restorePlatform = stubPlatform('win32')
        })

        afterEach(() => restorePlatform())

        it('accepts a readable file without an execute bit', () => {
            const readable = createFile('chrome.exe', 0o644)

            const options = resolveChromiumLaunchOptions(missingPinnedPath, {
                [explicitVariable]: readable
            })

            expect(options).toEqual({ executablePath: readable })
        })

        it.skipIf(isRoot)('rejects an unreadable file', () => {
            const unreadable = createFile('locked.exe', 0o000)

            expect(() =>
                resolveChromiumLaunchOptions(missingPinnedPath, {
                    [explicitVariable]: unreadable
                })
            ).toThrowError(explicitVariable)
        })

        it('still rejects directories', () => {
            expect(() =>
                resolveChromiumLaunchOptions(missingPinnedPath, { [explicitVariable]: sandbox })
            ).toThrowError(explicitVariable)
        })
    })
})

describe('playwright configs', () => {
    const chromiumProject = (config: { projects?: unknown }) =>
        (config.projects as ProjectConfig[]).find((p) => p.name === 'chromium')

    it('root config uses the configured Chromium executable when the pinned browser is missing', async () => {
        vi.stubEnv(explicitVariable, executable)
        const { default: config } = await import('../../playwright.config')

        expect(chromiumProject(config)?.use?.launchOptions).toEqual({ executablePath: executable })
    })

    it('docs config uses the configured Chromium executable and leaves Firefox untouched', () => {
        // jsdom cannot load the docs config (Vite rewrites its `new URL(..., import.meta.url)`),
        // so evaluate it in a real Node process. Pointing PLAYWRIGHT_BROWSERS_PATH at an empty
        // directory makes Playwright's own pinned executable path genuinely absent.
        const emptyBrowsers = join(sandbox, 'no-browsers')
        mkdirSync(emptyBrowsers)
        const script = `
            const { default: config } = await import(${JSON.stringify(docsConfigPath)})
            console.log(JSON.stringify(config.projects.map(({ name, use }) => ({ name, launchOptions: use.launchOptions }))))
        `

        const output = execFileSync(
            process.execPath,
            ['--import', 'tsx', '--input-type=module', '-e', script],
            {
                cwd: repoRoot,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    PLAYWRIGHT_BROWSERS_PATH: emptyBrowsers,
                    [explicitVariable]: executable
                }
            }
        )

        expect(JSON.parse(output.trim().split('\n').pop()!)).toEqual([
            { name: 'chromium', launchOptions: { executablePath: executable } },
            { name: 'firefox' }
        ])
    })

    it('leaves launch options empty when no fallback is configured', async () => {
        vi.stubEnv(explicitVariable, '')
        vi.stubEnv('PLAYWRIGHT_BROWSERS_PATH', '')
        const { default: config } = await import('../../playwright.config')

        expect(chromiumProject(config)?.use?.launchOptions).toEqual({})
    })
})
