import { scroll } from 'motion'
import {
    cancelMicrotask,
    microtask,
    motionValue,
    supportsScrollTimeline,
    supportsViewTimeline,
    type AccelerateConfig,
    type AnimationPlaybackControls
} from 'motion-dom'
import { augmentMotionValue, type AugmentedMotionValue } from './augmentMotionValue.svelte.js'
import { isRefPending, resolveElement, type ElementOrGetter } from './dom.js'
import { offsetToViewTimelineRange } from './viewTimelineRange.js'

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
 * A scroll offset edge defined as a string (e.g. `"start"`, `"end"`,
 * `"center"`) or a number (0–1 progress). Each offset entry is a pair of
 * `[target, container]`.
 *
 * Intentionally looser than motion's internal `ScrollOffset` type — that
 * uses template-literal types (`` `${Edge} ${Edge}` ``) we don't want to
 * surface to consumers. The runtime call paths through `scroll(...)` cast
 * `options.offset as never` to bridge the two; safe because every shape our
 * type allows is structurally a member of motion's union.
 */
type ScrollOffset = Array<[number | string, number | string]> | string[]

/**
 * Whether this scroll configuration can be driven by a native CSS
 * scroll-timeline / view-timeline. When `true`, the resulting motion value
 * runs on the compositor thread without per-frame JS callbacks.
 *
 * With a `target`, the `offset` must map to a native ViewTimeline range. That
 * is decided by motion v13.4.7's general rule (`offsetToViewTimelineRange` in
 * `scroll/utils/offset-to-range.ts`, ported in `viewTimelineRange.ts`): any
 * two-point offset whose container edges are `start`/`end` and whose lengths
 * are proportional (no px/vw/vh).
 */
const canAccelerateScroll = (target?: ElementOrGetter, offset?: ScrollOffset): boolean => {
    if (typeof window === 'undefined') return false
    return target
        ? supportsViewTimeline() && !!offsetToViewTimelineRange(offset)
        : supportsScrollTimeline()
}

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
 * representing scroll position and normalised progress for both axes, each
 * augmented with `.current` + `.subscribe`.
 */
export type UseScrollReturn = {
    scrollX: AugmentedMotionValue<number>
    scrollY: AugmentedMotionValue<number>
    scrollXProgress: AugmentedMotionValue<number>
    scrollYProgress: AugmentedMotionValue<number>
}

/**
 * Build the AccelerateConfig for a progress motion value driven by a native
 * scroll-timeline / view-timeline animation. Mirrors framer-motion's
 * `makeAccelerateConfig` 1:1: the `factory` defers `scroll()` until refs
 * hydrate via `microtask.read`, then attaches the animation; the `times` /
 * `keyframes` / `ease` / `duration` describe the 0→1 linear mapping.
 */
const makeAccelerateConfig = (axis: 'x' | 'y', options: UseScrollOptions): AccelerateConfig => ({
    factory: (animation: AnimationPlaybackControls) => {
        let cleanup: VoidFunction | undefined
        const start = () => {
            if (isRefPending(options.container) || isRefPending(options.target)) {
                microtask.read(start)
                return
            }
            cleanup = scroll(animation, {
                offset: options.offset as never,
                axis,
                container: resolveElement(options.container),
                target: resolveElement(options.target)
            })
        }
        microtask.read(start)
        return () => {
            cancelMicrotask(start)
            cleanup?.()
        }
    },
    times: [0, 1],
    keyframes: [0, 1],
    ease: (v: number) => v,
    duration: 1
})

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
 * **GPU-accelerated when supported.** On browsers that implement CSS
 * scroll-timeline (no `target`) or view-timeline (with a `target` and an
 * `offset` that maps to a native range, per motion v13.4.7's
 * `offsetToViewTimelineRange`), the *Progress motion values run on the compositor
 * thread via WAAPI — no per-frame JS callback. The non-progress
 * `scrollX` / `scrollY` motion values always use the JS-driven `scroll()`
 * primitive since the absolute pixel offset isn't directly available from
 * native timelines.
 *
 * `container` and `target` accept either an `HTMLElement` directly or a
 * getter `() => HTMLElement | undefined`. The getter form is the right
 * choice with `bind:this`. Element resolution is deferred to a microtask
 * (matches React framer-motion 1:1, faster than rAF polling), so a getter
 * that hasn't hydrated yet is retried as soon as Svelte's mount tick
 * settles it.
 *
 * Lifecycle: the underlying `scroll()` observer and any accelerate factory
 * attach at mount via `$effect` and detach at unmount, regardless of how
 * many consumers are reading the values. The four motion values are torn
 * down at the same time.
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
export const useScroll = (options: UseScrollOptions = {}): UseScrollReturn => {
    const scrollX = motionValue<number>(0)
    const scrollY = motionValue<number>(0)
    const scrollXProgress = motionValue<number>(0)
    const scrollYProgress = motionValue<number>(0)

    // SSR: return static motion values with no observer and no $effect.
    if (typeof window === 'undefined') {
        return {
            scrollX: augmentMotionValue(scrollX),
            scrollY: augmentMotionValue(scrollY),
            scrollXProgress: augmentMotionValue(scrollXProgress),
            scrollYProgress: augmentMotionValue(scrollYProgress)
        }
    }

    // The *Progress MVs accelerate to the compositor thread when the browser
    // supports CSS scroll/view-timelines; the non-progress scrollX/scrollY
    // MVs always need the JS callback for absolute pixel offsets.
    if (canAccelerateScroll(options.target, options.offset)) {
        scrollXProgress.accelerate = makeAccelerateConfig('x', options)
        scrollYProgress.accelerate = makeAccelerateConfig('y', options)
    }

    let cleanup: VoidFunction | undefined
    const start = () => {
        if (isRefPending(options.container) || isRefPending(options.target)) {
            microtask.read(start)
            return
        }
        cleanup = scroll(
            (_progress: number, info: ScrollInfo) => {
                scrollX.set(info.x.current)
                scrollY.set(info.y.current)
                scrollXProgress.set(info.x.progress)
                scrollYProgress.set(info.y.progress)
            },
            {
                container: resolveElement(options.container),
                target: resolveElement(options.target),
                offset: options.offset as never,
                axis: options.axis
            }
        )
    }

    $effect(() => {
        microtask.read(start)
        return () => {
            cancelMicrotask(start)
            cleanup?.()
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
