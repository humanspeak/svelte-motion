import { scroll } from 'motion'
import {
    cancelMicrotask,
    microtask,
    motionValue,
    supportsScrollTimeline,
    supportsViewTimeline,
    type AnimationPlaybackControls
} from 'motion-dom'
import { augmentMotionValue, type AugmentedMotionValue } from './augmentMotionValue.svelte.js'
import { resolveElement, type ElementOrGetter } from './dom.js'

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
 */
type ScrollOffset = Array<[number | string, number | string]> | string[]

/**
 * Pair of intersection points used by the accelerate-config preset matcher.
 */
type ProgressIntersection = [number, number]

/**
 * View-timeline range string pair (`entry`, `exit`, `cover`, `contain`).
 * When `offset` matches one of motion-dom's named presets we can drive the
 * scroll-linked animation via native CSS view-timelines instead of JS
 * callbacks — `accelerate` ships it to the compositor thread.
 */
type ViewTimelineRange = { rangeStart: string; rangeEnd: string }

/**
 * Named view-timeline presets — mirror framer-motion's ScrollOffset table.
 * Each entry is a pair of `[target, container]` intersection points that
 * defines a phase of the scroll relationship.
 */
const VIEW_TIMELINE_PRESETS: ReadonlyArray<readonly [ProgressIntersection[], string]> = [
    [
        [
            [0, 1],
            [1, 1]
        ],
        'entry'
    ],
    [
        [
            [0, 0],
            [1, 0]
        ],
        'exit'
    ],
    [
        [
            [1, 0],
            [0, 1]
        ],
        'cover'
    ],
    [
        [
            [0, 0],
            [1, 1]
        ],
        'contain'
    ]
]

const PROGRESS_BY_STRING: Record<string, number> = { start: 0, end: 1 }

/**
 * Parse `"start end"` / `"end start"` / etc. into an explicit
 * `[target, container]` intersection pair.
 */
const parseStringOffset = (s: string): ProgressIntersection | undefined => {
    const parts = s.trim().split(/\s+/)
    if (parts.length !== 2) return undefined
    const a = PROGRESS_BY_STRING[parts[0]]
    const b = PROGRESS_BY_STRING[parts[1]]
    if (a === undefined || b === undefined) return undefined
    return [a, b]
}

/**
 * Normalize a {@link ScrollOffset} into an array of explicit intersection
 * pairs, or `undefined` if the shape doesn't match the simple two-element
 * preset form.
 */
const normaliseOffset = (offset: ScrollOffset): ProgressIntersection[] | undefined => {
    if (offset.length !== 2) return undefined
    const result: ProgressIntersection[] = []
    for (const item of offset) {
        if (Array.isArray(item)) {
            result.push(item as ProgressIntersection)
        } else if (typeof item === 'string') {
            const parsed = parseStringOffset(item)
            if (!parsed) return undefined
            result.push(parsed)
        } else {
            return undefined
        }
    }
    return result
}

const matchesPreset = (offset: ScrollOffset, preset: ProgressIntersection[]): boolean => {
    const normalised = normaliseOffset(offset)
    if (!normalised) return false
    for (let i = 0; i < 2; i++) {
        const o = normalised[i]!
        const p = preset[i]!
        if (o[0] !== p[0] || o[1] !== p[1]) return false
    }
    return true
}

/**
 * Map a {@link ScrollOffset} to its corresponding CSS view-timeline range, if
 * any. Returning `undefined` signals the caller to fall back to JS-driven
 * scroll tracking. Mirrors framer-motion's `offsetToViewTimelineRange`.
 */
const offsetToViewTimelineRange = (offset?: ScrollOffset): ViewTimelineRange | undefined => {
    if (!offset) return { rangeStart: 'contain 0%', rangeEnd: 'contain 100%' }
    for (const [preset, name] of VIEW_TIMELINE_PRESETS) {
        if (matchesPreset(offset, preset)) {
            return { rangeStart: `${name} 0%`, rangeEnd: `${name} 100%` }
        }
    }
    return undefined
}

/**
 * Whether this scroll configuration can be driven by a native CSS
 * scroll-timeline / view-timeline. When `true`, the resulting motion value
 * runs on the compositor thread without per-frame JS callbacks.
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
 * Tests whether an `ElementOrGetter` is currently unresolved — defined as a
 * getter, but the getter returns falsy. Lets the microtask-defer loop wait
 * for refs to hydrate post-mount.
 */
const isRefPending = (ref?: ElementOrGetter): boolean => {
    if (!ref) return false
    // Direct elements are never "pending" — they were already resolved at
    // call time.
    if (typeof ref !== 'function') return false
    return !ref()
}

/**
 * Build the AccelerateConfig for a progress motion value driven by a native
 * scroll-timeline / view-timeline animation. Mirrors framer-motion's
 * `makeAccelerateConfig` 1:1: the `factory` defers `scroll()` until refs
 * hydrate via `microtask.read`, then attaches the animation; the `times` /
 * `keyframes` / `ease` / `duration` describe the 0→1 linear mapping.
 */
const makeAccelerateConfig = (
    axis: 'x' | 'y',
    options: UseScrollOptions
): {
    factory: (animation: AnimationPlaybackControls) => VoidFunction
    times: number[]
    keyframes: number[]
    ease: (v: number) => number
    duration: number
} => ({
    factory: (animation) => {
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
 * scroll-timeline (no `target`) or view-timeline (with a `target` and a
 * preset `offset`), the *Progress motion values run on the compositor
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

    // WAAPI acceleration for the *Progress motion values when the browser
    // supports it. The non-progress scrollX/scrollY MVs need pixel offsets
    // which native timelines don't expose, so they always go through the
    // JS-driven scroll() callback below.
    if (canAccelerateScroll(options.target, options.offset)) {
        ;(
            scrollXProgress as unknown as { accelerate: ReturnType<typeof makeAccelerateConfig> }
        ).accelerate = makeAccelerateConfig('x', options)
        ;(
            scrollYProgress as unknown as { accelerate: ReturnType<typeof makeAccelerateConfig> }
        ).accelerate = makeAccelerateConfig('y', options)
    }

    // JS-driven scroll() observer. Provides absolute pixel offsets and is
    // the fallback when no acceleration is supported. Even when the
    // progress values are accelerated, the non-progress values still need
    // this path.
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
