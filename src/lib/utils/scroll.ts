import { scroll } from 'motion'
import { readable, writable, type Readable } from 'svelte/store'
import { createAttachable } from './attachable.js'
import { type ElementOrGetter } from './dom.js'

/**
 * Axis-level scroll information returned by the `scroll()` callback.
 */
type AxisScrollInfo = {
    current: number
    progress: number
    scrollLength: number
    velocity: number
}

/**
 * Full scroll information object supplied by `motion`'s `scroll()` function.
 */
type ScrollInfo = {
    time: number
    x: AxisScrollInfo
    y: AxisScrollInfo
}

/**
 * A scroll offset edge defined as a string (e.g. `"start"`, `"end"`, `"center"`)
 * or a number (0–1 progress). Each offset entry is a pair of `[target, container]`.
 */
type ScrollOffset = Array<[number | string, number | string]> | string[]

/**
 * Options accepted by `useScroll`.
 */
type UseScrollOptions = {
    /** Scrollable container to track. Defaults to the page. Accepts an element or a getter function. */
    container?: ElementOrGetter
    /** Target element to track position of within the container. Accepts an element or a getter function. */
    target?: ElementOrGetter
    /** Scroll offset configuration for element position tracking. */
    offset?: ScrollOffset
    /** Which axis to use for the single-axis `progress` value supplied to `scroll()`. */
    axis?: 'x' | 'y'
}

/**
 * Return type of `useScroll` — four readable Svelte stores representing
 * scroll position and normalised progress for both axes.
 */
type UseScrollReturn = {
    scrollX: Readable<number>
    scrollY: Readable<number>
    scrollXProgress: Readable<number>
    scrollYProgress: Readable<number>
}

/**
 * Creates scroll-linked Svelte stores for building scroll-driven animations
 * such as progress indicators and parallax effects.
 *
 * When the returned stores are used with `opacity` / `transform` CSS properties
 * the animations can be hardware accelerated by the browser.
 *
 * SSR-safe: returns static `readable(0)` stores on the server.
 *
 * `container` and `target` accept either an `HTMLElement` directly or a
 * getter function `() => HTMLElement | undefined`. This is useful with
 * Svelte's `bind:this` where the element isn't available until after mount.
 * When a getter is provided, element resolution is deferred until the
 * first subscriber arrives, and if the element isn't available yet the
 * stores poll on each animation frame until it is.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useScroll, useSpring } from '@humanspeak/svelte-motion'
 *
 *   const { scrollYProgress } = useScroll()
 *   const scaleX = useSpring(scrollYProgress)
 * </script>
 *
 * <div style="transform: scaleX({$scaleX}); transform-origin: left;" />
 * ```
 *
 * @param options Optional scroll tracking configuration.
 * @returns An object with `scrollX`, `scrollY`, `scrollXProgress`, and `scrollYProgress` stores.
 */
export const useScroll = (options?: UseScrollOptions): UseScrollReturn => {
    if (typeof window === 'undefined') {
        return {
            scrollX: readable(0),
            scrollY: readable(0),
            scrollXProgress: readable(0),
            scrollYProgress: readable(0)
        }
    }

    const stores: Record<string, ReturnType<typeof writable<number>>> = {
        scrollX: writable(0),
        scrollY: writable(0),
        scrollXProgress: writable(0),
        scrollYProgress: writable(0)
    }

    const attachable = createAttachable({
        refs: { container: options?.container, target: options?.target },
        onAttach: ({ container, target }) =>
            scroll(
                (_progress: number, info: ScrollInfo) => {
                    stores.scrollX.set(info.x.current)
                    stores.scrollY.set(info.y.current)
                    stores.scrollXProgress.set(info.x.progress)
                    stores.scrollYProgress.set(info.y.progress)
                },
                {
                    container,
                    target,
                    offset: options?.offset as never,
                    axis: options?.axis
                }
            )
    })

    const make = (key: string): Readable<number> =>
        readable(0, (set) => {
            const release = attachable.subscribe()
            const unsub = stores[key].subscribe(set)
            return () => {
                unsub()
                release()
            }
        })

    return {
        scrollX: make('scrollX'),
        scrollY: make('scrollY'),
        scrollXProgress: make('scrollXProgress'),
        scrollYProgress: make('scrollYProgress')
    }
}
