/**
 * Logging utility that only emits when Playwright flag is present.
 * Pages opt-in by including the query param `@isPlaywright=true`.
 *
 * In production builds (npm package), these are noops to reduce bundle size.
 */
import { DEV } from 'esm-env'

export const isPlaywrightEnv = (): boolean => {
    if (typeof window === 'undefined') return false
    return window.location.search.includes('@isPlaywright=true')
}

export const pwLog = (...args: unknown[]) => {
    if (!DEV) return
    if (!isPlaywrightEnv()) return
    console.log(...args)
}

export const pwWarn = (...args: unknown[]) => {
    if (!DEV) return
    if (!isPlaywrightEnv()) return
    console.warn(...args)
}
