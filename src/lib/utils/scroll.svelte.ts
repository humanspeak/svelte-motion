import { scroll } from 'motion'
import { motionValue } from 'motion-dom'
import { createAttachable } from './attachable.js'
import { augmentMotionValue, type AugmentedMotionValue } from './augmentMotionValue.svelte.js'
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
 * Options accepted by {@link useScroll}.
 */
export type UseScrollOptions = {
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
 * Return type of {@link useScroll} — four motion-dom `MotionValue<number>`s
 * representing scroll position and normalised progress for both axes.
 *
 * Each value is augmented with a `$state`-backed `.current` getter and a
 * Svelte readable `.subscribe` shim, so `scrollY.current` reads reactively
 * in Svelte 5 scopes and `$scrollY` still works for store-style consumers.
 */
export type UseScrollReturn = {
    scrollX: AugmentedMotionValue<number>
    scrollY: AugmentedMotionValue<number>
    scrollXProgress: AugmentedMotionValue<number>
    scrollYProgress: AugmentedMotionValue<number>
}

/**
 * Creates scroll-linked motion values for building scroll-driven animations
 * such as progress indicators and parallax effects.
 *
 * Returns four `MotionValue<number>`s: `scrollX` / `scrollY` (current
 * position in px) and `scrollXProgress` / `scrollYProgress` (0–1
 * normalised). Each is a real motion-dom `MotionValue` augmented with a
 * `$state`-backed `.current` getter and a `.subscribe` shim, so they
 * compose with `useTransform`, `useSpring`, and the rest of the Tier 2
 * surface, and they read reactively in Svelte 5 templates.
 *
 * `container` and `target` accept either an `HTMLElement` directly or a
 * getter function `() => HTMLElement | undefined`. The getter form is the
 * right choice with `bind:this` — element resolution is deferred and the
 * hook polls on `requestAnimationFrame` until it appears.
 *
 * Lifecycle: the underlying `scroll()` observer attaches at mount via
 * `$effect` and detaches at unmount, regardless of how many consumers are
 * reading the values. The four motion values are torn down at the same
 * time. This is a deliberate divergence from the previous store-based
 * impl, which attached lazily on first subscribe.
 *
 * SSR-safe: returns four static `motionValue(0)`s with no scroll observer
 * on the server.
 *
 * @param options Optional scroll tracking configuration.
 * @returns Four `MotionValue<number>`s — `scrollX`, `scrollY`, `scrollXProgress`, `scrollYProgress`.
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
 * <div style="transform: scaleX({scaleX.current}); transform-origin: left;" />
 * ```
 *
 * @see https://motion.dev/docs/react-use-scroll
 */
export const useScroll = (options?: UseScrollOptions): UseScrollReturn => {
    const scrollX = motionValue<number>(0)
    const scrollY = motionValue<number>(0)
    const scrollXProgress = motionValue<number>(0)
    const scrollYProgress = motionValue<number>(0)

    // SSR: return static motion values with no observer and no $effect.
    // Matches useSpring's pattern — `$effect` requires a reactive scope and
    // server rendering doesn't run effects anyway.
    if (typeof window === 'undefined') {
        return {
            scrollX: augmentMotionValue(scrollX),
            scrollY: augmentMotionValue(scrollY),
            scrollXProgress: augmentMotionValue(scrollXProgress),
            scrollYProgress: augmentMotionValue(scrollYProgress)
        }
    }

    const attachable = createAttachable({
        refs: { container: options?.container, target: options?.target },
        onAttach: ({ container, target }) =>
            scroll(
                (_progress: number, info: ScrollInfo) => {
                    scrollX.set(info.x.current)
                    scrollY.set(info.y.current)
                    scrollXProgress.set(info.x.progress)
                    scrollYProgress.set(info.y.progress)
                },
                {
                    container,
                    target,
                    offset: options?.offset as never,
                    axis: options?.axis
                }
            )
    })

    $effect(() => {
        const release = attachable.subscribe()
        return () => {
            release()
            scrollX.destroy()
            scrollY.destroy()
            scrollXProgress.destroy()
            scrollYProgress.destroy()
        }
    })

    return {
        scrollX: augmentMotionValue(scrollX),
        scrollY: augmentMotionValue(scrollY),
        scrollXProgress: augmentMotionValue(scrollXProgress),
        scrollYProgress: augmentMotionValue(scrollYProgress)
    }
}
