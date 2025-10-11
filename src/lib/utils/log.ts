/**
 * Logging utility that only emits when Playwright flag is present.
 * Pages opt-in by including the query param `@humanspeak-svelte-motion-isPlaywright=true`.
 */
const isPlaywrightEnv = (): boolean => {
    if (typeof window === 'undefined') return false
    return window.location.search.includes('@humanspeak-svelte-motion-isPlaywright=true')
}

export const pwLog = (...args: unknown[]) => {
    if (!isPlaywrightEnv()) return
    console.log(...args)
}

export const pwWarn = (...args: unknown[]) => {
    if (!isPlaywrightEnv()) return
    console.warn(...args)
}
