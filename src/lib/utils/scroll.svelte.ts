import { scroll } from 'motion'
import {
    motionValue,
    supportsScrollTimeline,
    supportsViewTimeline,
    type AccelerateConfig,
    type AnimationPlaybackControls
} from 'motion-dom'
import { augmentMotionValue, type AugmentedMotionValue } from './augmentMotionValue.svelte.js'
import { isRefPending, resolveElement, type ElementOrGetter } from './dom.js'
import { scheduleRefRetry } from './refRetry.js'
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
 *
 * Without a `target`, only an offset-free page/container scroll can use a
 * ScrollTimeline, which has no notion of an offset; with one, the JS timeline
 * applies it. Mirrors motion v13.5.0 `use-scroll.ts`
 * (`supportsScrollTimeline() && !offset`).
 */
const canAccelerateScroll = (target?: ElementOrGetter, offset?: ScrollOffset): boolean => {
    if (typeof window === 'undefined') return false
    return target
        ? supportsViewTimeline() && !!offsetToViewTimelineRange(offset)
        : supportsScrollTimeline() && !offset
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
    /**
     * When true, enables per-frame checking of scrollWidth/scrollHeight
     * to detect content size changes and recalculate scroll progress.
     *
     * @default false
     */
    trackContentSize?: boolean
}

/**
 * The `scroll()` options other than the element refs, forwarded as-is like
 * upstream's `...options` spread (framer-motion `use-scroll.ts:63-64, 96, 138`
 * @ v14.7.1). `offset` is cast because our {@link ScrollOffset} is looser
 * than motion's.
 *
 * @param options The `useScroll` options.
 * @returns The options to spread into `scroll()`, without `container` / `target`.
 */
const forwardedScrollOptions = (options: UseScrollOptions) => {
    const forwarded: Omit<UseScrollOptions, 'offset'> & { offset?: never } = {
        ...options,
        offset: options.offset as never
    }
    delete forwarded.container
    delete forwarded.target
    return forwarded
}

/**
 * Return type of {@link useScroll} — six motion-dom `MotionValue<number>`s:
 * scroll position, normalised progress and maximum scroll offset for both
 * axes, each augmented with `.current` + `.subscribe`.
 */
export type UseScrollReturn = {
    scrollX: AugmentedMotionValue<number>
    scrollY: AugmentedMotionValue<number>
    scrollXProgress: AugmentedMotionValue<number>
    scrollYProgress: AugmentedMotionValue<number>
    /** Maximum horizontal scroll offset in px (`scrollWidth - clientWidth` for a container). */
    scrollXLength: AugmentedMotionValue<number>
    /**
     * Maximum vertical scroll offset in px. The distance from the end is
     * `scrollYLength.get() - scrollY.get()`.
     */
    scrollYLength: AugmentedMotionValue<number>
}

/**
 * Build the AccelerateConfig for a progress motion value driven by a native
 * scroll-timeline / view-timeline animation. Mirrors framer-motion's
 * `makeAccelerateConfig`: the `factory` defers `scroll()` until refs hydrate,
 * then attaches the animation; the `times` / `keyframes` / `ease` /
 * `duration` describe the 0→1 linear mapping.
 *
 * Deliberate divergence from upstream (`framer-motion`
 * `src/value/use-scroll.ts:47-55` @ v14.6.0): upstream re-schedules its
 * `start` read on the `microtask` batcher from inside that same job, which leaves
 * motion-dom's shared batcher stalled (`motion-dom/src/frameloop/batcher.ts`
 * processBatch / wake / schedule). Here the retry goes through
 * `scheduleRefRetry`: the first attempt is a plain microtask (same "defer
 * until `bind:this` settles" timing), later attempts wait an animation frame.
 *
 * @param axis Which axis the progress value tracks.
 * @param options The `useScroll` options supplying container / target / offset.
 * @returns The `AccelerateConfig` to assign to the progress motion value.
 */
const makeAccelerateConfig = (axis: 'x' | 'y', options: UseScrollOptions): AccelerateConfig => ({
    factory: (animation: AnimationPlaybackControls) => {
        let cleanup: VoidFunction | undefined
        let cancelRetry: (() => void) | undefined
        let attempt = 0
        const start = () => {
            if (isRefPending(options.container) || isRefPending(options.target)) {
                cancelRetry = scheduleRefRetry(start, attempt++)
                return
            }
            cleanup = scroll(animation, {
                ...forwardedScrollOptions(options),
                axis,
                container: resolveElement(options.container),
                target: resolveElement(options.target)
            })
        }
        cancelRetry = scheduleRefRetry(start, attempt++)
        return () => {
            cancelRetry?.()
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
 * Returns six `MotionValue<number>`s: `scrollX` / `scrollY` (current
 * position in px), `scrollXProgress` / `scrollYProgress` (0–1
 * normalised) and `scrollXLength` / `scrollYLength` (maximum scroll
 * offset in px). Each is a real motion-dom `MotionValue` augmented with a
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
 * The `scrollXLength` / `scrollYLength` values follow Motion 14.7.1
 * (`623a0e7b6`, #2189) and are never accelerated: they are always written by
 * the JS `scroll()` callback.
 *
 * `container` and `target` accept either an `HTMLElement` directly or a
 * getter `() => HTMLElement | undefined`. The getter form is the right
 * choice with `bind:this`. Element resolution is deferred to a microtask
 * (same timing as React framer-motion), so a getter that hydrates in Svelte's
 * mount tick attaches before the next frame; a getter that is still
 * unresolved is retried on animation frames.
 *
 * Lifecycle: the underlying `scroll()` observer and any accelerate factory
 * attach at mount via `$effect` and detach at unmount, regardless of how
 * many consumers are reading the values. All six motion values are torn
 * down at the same time.
 *
 * SSR-safe: returns six static `motionValue(0)`s with no scroll observer
 * on the server.
 *
 * @param options Optional scroll tracking configuration.
 * @returns Six `MotionValue<number>`s — `scrollX`, `scrollY`, `scrollXProgress`, `scrollYProgress`,
 *   `scrollXLength`, `scrollYLength`.
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
 * @example
 * ```svelte
 * <script>
 *   import { useScroll } from '@humanspeak/svelte-motion'
 *
 *   let containerEl = $state()
 *   const { scrollY, scrollYLength } = useScroll({ container: () => containerEl })
 *   const remaining = $derived(scrollYLength.current - scrollY.current)
 * </script>
 *
 * <div bind:this={containerEl} style="height: 300px; overflow: auto;">…</div>
 * <p>{Math.round(remaining)}px left</p>
 * ```
 *
 * @see https://motion.dev/docs/react-use-scroll
 */
export const useScroll = (options: UseScrollOptions = {}): UseScrollReturn => {
    const scrollX = motionValue<number>(0)
    const scrollY = motionValue<number>(0)
    const scrollXProgress = motionValue<number>(0)
    const scrollYProgress = motionValue<number>(0)
    const scrollXLength = motionValue<number>(0)
    const scrollYLength = motionValue<number>(0)

    // SSR: return static motion values with no observer and no $effect.
    if (typeof window === 'undefined') {
        return {
            scrollX: augmentMotionValue(scrollX),
            scrollY: augmentMotionValue(scrollY),
            scrollXProgress: augmentMotionValue(scrollXProgress),
            scrollYProgress: augmentMotionValue(scrollYProgress),
            scrollXLength: augmentMotionValue(scrollXLength),
            scrollYLength: augmentMotionValue(scrollYLength)
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
    let cancelRetry: (() => void) | undefined
    let attempt = 0
    const start = () => {
        if (isRefPending(options.container) || isRefPending(options.target)) {
            cancelRetry = scheduleRefRetry(start, attempt++)
            return
        }
        cleanup = scroll(
            (_progress: number, info: ScrollInfo) => {
                // Same order as framer-motion `use-scroll.ts:130-135` @ v14.7.1.
                scrollX.set(info.x.current)
                scrollXProgress.set(info.x.progress)
                scrollXLength.set(info.x.scrollLength)
                scrollY.set(info.y.current)
                scrollYProgress.set(info.y.progress)
                scrollYLength.set(info.y.scrollLength)
            },
            {
                ...forwardedScrollOptions(options),
                container: resolveElement(options.container),
                target: resolveElement(options.target)
            }
        )
    }

    $effect(() => {
        cancelRetry = scheduleRefRetry(start, attempt++)
        return () => {
            cancelRetry?.()
            cleanup?.()
            scrollX.destroy()
            scrollY.destroy()
            scrollXProgress.destroy()
            scrollYProgress.destroy()
            scrollXLength.destroy()
            scrollYLength.destroy()
        }
    })

    return {
        scrollX: augmentMotionValue(scrollX),
        scrollY: augmentMotionValue(scrollY),
        scrollXProgress: augmentMotionValue(scrollXProgress),
        scrollYProgress: augmentMotionValue(scrollYProgress),
        scrollXLength: augmentMotionValue(scrollXLength),
        scrollYLength: augmentMotionValue(scrollYLength)
    }
}
