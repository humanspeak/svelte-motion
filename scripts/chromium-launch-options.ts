import { accessSync, constants, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Launch options contributed by {@link resolveChromiumLaunchOptions}.
 *
 * An empty object means "let Playwright use its own pinned browser".
 */
export type ChromiumLaunchOptions = { executablePath?: string }

const executablePathVariable = 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'

/**
 * Checks that a path is a regular file the current platform can run.
 *
 * On POSIX the execute bit is required; on Windows execute permission does not
 * exist, so readability is checked instead.
 *
 * @param path - Absolute or relative path to inspect.
 * @returns `true` when the path is a regular, runnable file; otherwise `false`.
 */
const isRegularExecutable = (path: string): boolean => {
    try {
        if (!statSync(path).isFile()) return false
        accessSync(path, process.platform === 'win32' ? constants.R_OK : constants.X_OK)
        return true
    } catch {
        return false
    }
}

/**
 * Returns a trimmed environment value, treating empty or whitespace-only values as unset.
 *
 * @param value - Raw environment value.
 * @returns The trimmed value, or `undefined` when unset or blank.
 */
const readEnvironmentValue = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
}

/**
 * Resolves Chromium launch options for Playwright consumers.
 *
 * The Playwright-pinned browser always wins. When it is not installed, an
 * externally supplied Chromium is used, in this order:
 *
 * 1. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. An invalid value throws; no other
 *    browser is substituted for an explicit request.
 * 2. `<PLAYWRIGHT_BROWSERS_PATH>/chromium`, a cloud-image convention for an
 *    actual executable (not Playwright's revision-directory cache layout).
 *    Selected only when it is a runnable regular file.
 *
 * Otherwise an empty object is returned so Playwright reports its normal
 * missing-browser diagnostics. Nothing is executed, downloaded or scanned.
 *
 * Limitations: an arbitrary Chromium build has no Playwright compatibility
 * guarantee, and the result is never a substitute for pinned-browser CI.
 * Callers keep their own browser-package selection and pass that package's
 * `executablePath()` as `pinnedExecutablePath`.
 *
 * @param pinnedExecutablePath - Path Playwright expects for its pinned Chromium.
 * @param env - Environment to read; defaults to `process.env`.
 * @returns Options to spread into `launchOptions`, empty when no override applies.
 * @throws {Error} When `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` is set but not a runnable file.
 */
export const resolveChromiumLaunchOptions = (
    pinnedExecutablePath: string,
    env: Record<string, string | undefined> = process.env
): ChromiumLaunchOptions => {
    if (isRegularExecutable(pinnedExecutablePath)) return {}

    const explicitPath = readEnvironmentValue(env[executablePathVariable])
    if (explicitPath) {
        if (!isRegularExecutable(explicitPath)) {
            throw new Error(
                `${executablePathVariable} is set to "${explicitPath}", which is not a runnable ` +
                    'regular file. Point it at a Chromium executable, unset it, or install the ' +
                    'Playwright browser with "pnpm exec playwright install chromium".'
            )
        }
        return { executablePath: explicitPath }
    }

    const browsersPath = readEnvironmentValue(env.PLAYWRIGHT_BROWSERS_PATH)
    // "0" is Playwright's sentinel for the in-package browser location, not a directory.
    if (browsersPath && browsersPath !== '0') {
        const candidate = join(browsersPath, 'chromium')
        if (isRegularExecutable(candidate)) return { executablePath: candidate }
    }

    return {}
}
