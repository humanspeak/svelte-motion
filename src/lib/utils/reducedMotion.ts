import { readable, type Readable } from 'svelte/store'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const SSR_FALLBACK: Readable<boolean> = readable(false, () => {})

/**
 * Returns a readable store that reflects the user's `prefers-reduced-motion` setting.
 *
 * Defaults to `false` in SSR or when `matchMedia` is unavailable/throws.
 *
 * @returns {Readable<boolean>} `true` when the user prefers reduced motion.
 * @see https://motion.dev/docs/react-reduced-motion
 *
 * @example
 * ```svelte
 * <script>
 *   import { useReducedMotion } from '@humanspeak/svelte-motion'
 *   const reduced = useReducedMotion()
 * </script>
 *
 * <div style:transform={$reduced ? 'none' : 'rotate(45deg)'}>...</div>
 * ```
 */
export const useReducedMotion = (): Readable<boolean> => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return SSR_FALLBACK
    }

    let media: MediaQueryList
    try {
        media = window.matchMedia(REDUCED_MOTION_QUERY)
    } catch {
        return SSR_FALLBACK
    }

    return readable(media.matches, (set) => {
        const handler = (event: MediaQueryListEvent) => set(event.matches)

        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', handler)
            return () => media.removeEventListener('change', handler)
        }

        media.addListener(handler)
        return () => media.removeListener(handler)
    })
}
