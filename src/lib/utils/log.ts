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
 * The optional `payload` may be a thunk (`() => value`). Because `pwLog` is a
 * no-op outside DEV+Playwright, wrapping expensive payloads — anything that
 * forces layout or style reads such as `el.getBoundingClientRect()` or
 * `getComputedStyle(el)` — in a thunk defers that work so shipped consumers
 * never pay for discarded log arguments. When logging is active the thunk is
 * invoked and its return value is logged, identical to passing the value
 * directly. Plain (non-function) payloads are logged unchanged.
 *
 * New call sites that read the DOM for their payload MUST use the thunk form.
 *
 * @param message Log label forwarded to `console.log`.
 * @param payload Optional value, or a thunk returning the value to log.
 */
export const pwLog = (message: string, payload?: unknown) => {
    if (!DEV) return
    if (!isPlaywrightEnv()) return
    if (typeof payload === 'function') {
        console.log(message, (payload as () => unknown)())
        return
    }
    if (payload === undefined) {
        console.log(message)
        return
    }
    console.log(message, payload)
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
