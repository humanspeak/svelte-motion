/**
 * Logging utility that only emits when Playwright flag is present.
 * Pages opt-in by including the query param `@humanspeak-svelte-motion-isPlaywright=true`.
 *
 * In production builds (npm package), these are noops to reduce bundle size.
 */
const isPlaywrightEnv = (): boolean => {
    if (typeof window === 'undefined') return false
    return window.location.search.includes('@humanspeak-svelte-motion-isPlaywright=true')
}

const isProduction = import.meta.env?.MODE === 'production' || import.meta.env?.PROD === true

export const pwLog = (...args: unknown[]) => {
    if (isProduction) return
    if (!isPlaywrightEnv()) return
    console.log(...args)
}

export const pwWarn = (...args: unknown[]) => {
    if (isProduction) return
    if (!isPlaywrightEnv()) return
    console.warn(...args)
}
