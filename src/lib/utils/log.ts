/**
 * Logging utility that only emits when Playwright flag is present.
 * Pages opt-in by including the query param `@isPlaywright=true`.
 *
 * In production builds (npm package), these are noops to reduce bundle size.
 */
import { DEV } from 'esm-env'

/**
 * Detect whether the current page is running inside a Playwright test.
 *
 * @returns `true` when the URL contains the `@isPlaywright=true` query param.
 */
export const isPlaywrightEnv = (): boolean => {
    if (typeof window === 'undefined') return false
    return window.location.search.includes('@isPlaywright=true')
}

/**
 * Log to the console only in DEV mode inside a Playwright environment.
 *
 * @param args Values forwarded to `console.log`.
 */
export const pwLog = (...args: unknown[]) => {
    if (!DEV) return
    if (!isPlaywrightEnv()) return
    console.log(...args)
}

/**
 * Warn to the console only in DEV mode inside a Playwright environment.
 *
 * @param args Values forwarded to `console.warn`.
 */
export const pwWarn = (...args: unknown[]) => {
    if (!DEV) return
    if (!isPlaywrightEnv()) return
    console.warn(...args)
}
