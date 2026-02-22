import { derived, type Readable } from 'svelte/store'

/**
 * Tagged template literal that creates a derived store from interpolated
 * readable stores. When any input store changes, the resulting store
 * recomputes the template string.
 *
 * SSR-safe: `derived` from svelte/store works on the server.
 *
 * @example
 * ```ts
 * const blur = useSpring(0)
 * const filter = useMotionTemplate`blur(${blur}px)`
 * // $filter → "blur(0px)"
 * ```
 *
 * @param strings Static template string parts.
 * @param values Readable stores to interpolate.
 * @returns A readable store of the composed string.
 * @see https://motion.dev/docs/react-use-motion-template
 */
export const useMotionTemplate = (
    strings: TemplateStringsArray,
    ...values: Readable<number | string>[]
): Readable<string> => {
    if (values.length === 0) return derived([], () => strings[0] ?? '')

    return derived(values, (current) => {
        let result = ''
        for (let i = 0; i < strings.length; i++) {
            result += strings[i] ?? ''
            if (i < current.length) result += String(current[i])
        }
        return result
    })
}
