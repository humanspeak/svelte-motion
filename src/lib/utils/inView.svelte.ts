import {
    animate,
    inView as motionInView,
    type AnimationOptions,
    type DOMKeyframesDefinition
} from 'motion'
import type { MotionViewport } from '../types.js'
import { createAttachable } from './attachable.js'
import { createBooleanSnapshot, type BooleanSnapshot } from './booleanSnapshot.svelte.js'
import { type ElementOrGetter } from './dom.js'

const CSS_FUNCTION_RE = /\b(var|calc|min|max|clamp|rgb|rgba|hsl|hsla|url)\s*\(/i

/**
 * Read an inline CSS-function value (var/calc/url/etc.) for `propName`
 * directly from the element's style declaration. Returns `null` for missing
 * or non-function values so the caller can fall back to `getComputedStyle`.
 *
 * Uses `style.getPropertyValue` so values like `url(data:image/svg+xml;...)`
 * with nested semicolons are preserved intact - the browser has already
 * parsed the declaration, no string scraping required.
 *
 * @param el Element whose inline style is read.
 * @param propName Camel-case JS property name (e.g. `borderColor`).
 * @returns The inline CSS function value, or `null`.
 */
const getInlineCssFunction = (el: HTMLElement, propName: string): string | null => {
    const kebab = propName.replace(/([A-Z])/g, '-$1').toLowerCase()
    const value = el.style.getPropertyValue(kebab).trim()
    if (!value) return null
    return CSS_FUNCTION_RE.test(value) ? value : null
}

/**
 * Split a `whileInView` definition into the visual keyframes and an
 * optional nested `transition`. Mirrors the shape framer-motion uses
 * where a single object carries both the target values and their
 * timing config.
 *
 * Defensive against `undefined` / `null` input: `def ?? {}` ensures
 * destructuring never throws, and the returned `keyframes` is then an
 * empty record.
 *
 * @param def `whileInView` record possibly carrying a nested
 *   `transition` config. May be `null` / `undefined` defensively (the
 *   spread normalises to `{}`).
 * @returns Object with the keyframes (everything *except* `transition`)
 *   and the extracted `transition` (or `undefined` if none was nested).
 *
 * @example
 * ```ts
 * splitInViewDefinition({ opacity: 1, y: 0, transition: { duration: 0.5 } })
 * // → { keyframes: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }
 *
 * splitInViewDefinition({ opacity: 1 })
 * // → { keyframes: { opacity: 1 }, transition: undefined }
 * ```
 */
export const splitInViewDefinition = (
    def: Record<string, unknown>
): {
    keyframes: Record<string, unknown>
    transition?: AnimationOptions
} => {
    const { transition, ...rest } = (def ?? {}) as { transition?: AnimationOptions }
    return { keyframes: rest, transition }
}

/**
 * Compute the baseline values to restore to when an element leaves the
 * viewport — only for the keys named in `whileInView`. Any key the
 * element is not animating into stays as it was.
 *
 * For each key in `whileInView`, resolve a baseline by walking sources
 * in this preference order:
 *
 * 1. `animate[key]` — the user's declared resting state
 * 2. `initial[key]` — the pre-animation state
 * 3. Neutral transform defaults (e.g. `x: 0`, `scale: 1`, `opacity: 1`)
 *    when the key is a known transform property
 * 4. Inline CSS function value (`var(...)`, `calc(...)`, `url(...)`)
 *    read off `style.getPropertyValue` — handles cases where nested
 *    semicolons (e.g. `url(data:...;base64,...)`) would break a
 *    string-scrape
 * 5. `getComputedStyle(el)[key]` — last resort
 *
 * The walk is per-key, so different baseline keys may be sourced from
 * different layers.
 *
 * @param el Element whose computed style is read as the final fallback.
 *   Must be a real DOM node (the function reads inline style and
 *   `getComputedStyle`).
 * @param opts Layered animation definitions:
 * @param opts.initial Optional `initial` record from the component.
 * @param opts.animate Optional `animate` record from the component.
 * @param opts.whileInView The `whileInView` record — its keys drive
 *   which baseline entries get computed. Nested `transition` is
 *   stripped before walking.
 * @returns A new record containing one entry per key found in
 *   `opts.whileInView`. May be empty if `whileInView` is empty.
 *
 * @example
 * ```ts
 * computeInViewBaseline(element, {
 *   initial: { opacity: 0, y: 50 },
 *   animate: { opacity: 1, y: 0 },
 *   whileInView: { opacity: 1, scale: 1.1 }
 * })
 * // → { opacity: 1, scale: 1 }
 * //   opacity sourced from animate; scale falls to the neutral default.
 * ```
 */
export const computeInViewBaseline = (
    el: HTMLElement,
    opts: {
        initial?: Record<string, unknown>
        animate?: Record<string, unknown>
        whileInView?: Record<string, unknown>
    }
): Record<string, unknown> => {
    const baseline: Record<string, unknown> = {}
    const initialRecord = (opts.initial ?? {}) as Record<string, unknown>
    const animateRecord = (opts.animate ?? {}) as Record<string, unknown>
    const whileInViewRecordRaw = (opts.whileInView ?? {}) as Record<string, unknown>
    const whileInViewRecord = { ...whileInViewRecordRaw } as Record<string, unknown>
    delete (whileInViewRecord as Record<string, unknown>).transition

    const neutralTransformDefaults: Record<string, unknown> = {
        x: 0,
        y: 0,
        translateX: 0,
        translateY: 0,
        scale: 1,
        scaleX: 1,
        scaleY: 1,
        rotate: 0,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,
        skewX: 0,
        skewY: 0,
        opacity: 1
    }

    const cs = getComputedStyle(el)

    for (const key of Object.keys(whileInViewRecord)) {
        if (Object.prototype.hasOwnProperty.call(animateRecord, key)) {
            baseline[key] = animateRecord[key]
        } else if (Object.prototype.hasOwnProperty.call(initialRecord, key)) {
            baseline[key] = initialRecord[key]
        } else if (key in (neutralTransformDefaults as Record<string, unknown>)) {
            baseline[key] = neutralTransformDefaults[key]
        } else {
            const inlineValue = getInlineCssFunction(el, key)
            if (inlineValue) {
                baseline[key] = inlineValue
            } else if (key in (cs as unknown as Record<string, unknown>)) {
                baseline[key] = (cs as unknown as Record<string, unknown>)[key] as string
            }
        }
    }
    return baseline
}

/**
 * Wire a `whileInView` interaction onto an element using motion's
 * `inView` primitive. On viewport entry the element animates to the
 * supplied keyframes; on exit it animates back to a baseline computed
 * via {@link computeInViewBaseline}.
 *
 * Used internally by `motion.<tag>` components to power the
 * `whileInView` prop, and exposed for callers that want the same
 * declarative behavior without going through a motion component.
 *
 * When `viewport.once` is `true`, the element latches on first entry
 * — no exit animation runs, and the IntersectionObserver is detached
 * via a `queueMicrotask(stop)` after the entry handler returns.
 *
 * @param el Target element to observe and animate.
 * @param whileInView Keyframes to apply on entry. May carry a nested
 *   `transition` config (extracted via {@link splitInViewDefinition}).
 *   If `undefined`, the function returns a no-op cleanup without
 *   creating an observer.
 * @param mergedTransition Default transition used both when
 *   `whileInView` has no nested `transition` and for the exit
 *   animation back to baseline.
 * @param callbacks Optional lifecycle hooks:
 *   - `onStart` — fires on viewport entry, before the entry animation.
 *   - `onEnd` — fires on viewport exit, after the baseline restore
 *     animation kicks off. Not called when `viewport.once` is `true`.
 *   - `onAnimationComplete` — fires when the entry animation
 *     resolves; passed the keyframes that ran.
 * @param baselineSources Sources for {@link computeInViewBaseline}'s
 *   per-key walk:
 *   - `initial` — the component's `initial` record.
 *   - `animate` — the component's `animate` record.
 * @param viewport IntersectionObserver options:
 *   - `root` — scroll container (default page).
 *   - `margin` — `rootMargin` string.
 *   - `amount` — fraction visible required (defaults to `0` here so
 *     any pixel counts).
 *   - `once` — latch on first entry; skip exit animation.
 * @returns A cleanup function that detaches the IntersectionObserver
 *   on call. Safe to invoke after a `once` latch has already fired.
 *
 * @example
 * ```ts
 * const cleanup = attachWhileInView(
 *   element,
 *   { opacity: 1, y: 0, transition: { duration: 0.5 } },
 *   { duration: 0.3 },
 *   {
 *     onStart: () => trackImpression(),
 *     onEnd: () => console.log('left viewport')
 *   },
 *   { initial: { opacity: 0, y: 50 } },
 *   { once: true, amount: 0.5 }
 * )
 * // Later — typically component teardown:
 * cleanup()
 * ```
 */
export const attachWhileInView = (
    el: HTMLElement,
    whileInView: Record<string, unknown> | undefined,
    mergedTransition: AnimationOptions,
    callbacks?: {
        onStart?: () => void
        onEnd?: () => void
        onAnimationComplete?: (definition: DOMKeyframesDefinition | undefined) => void
    },
    baselineSources?: { initial?: Record<string, unknown>; animate?: Record<string, unknown> },
    viewport?: MotionViewport
): (() => void) => {
    if (!whileInView) return () => {}

    let latched = false

    const stop = motionInView(
        el,
        () => {
            if (latched) return
            const inViewBaseline = computeInViewBaseline(el, {
                initial: baselineSources?.initial,
                animate: baselineSources?.animate,
                whileInView
            })
            callbacks?.onStart?.()
            const { keyframes, transition } = splitInViewDefinition(whileInView)
            const animation = animate(
                el,
                keyframes as unknown as DOMKeyframesDefinition,
                (transition ?? mergedTransition) as AnimationOptions
            )
            animation.finished
                .then(() => {
                    callbacks?.onAnimationComplete?.(keyframes as unknown as DOMKeyframesDefinition)
                })
                .catch(() => {
                    /* animation cancelled — skip completion callback */
                })

            if (viewport?.once) {
                latched = true
                queueMicrotask(stop)
                return
            }

            return () => {
                if (Object.keys(inViewBaseline).length > 0) {
                    animate(
                        el,
                        inViewBaseline as unknown as DOMKeyframesDefinition,
                        mergedTransition
                    )
                }
                callbacks?.onEnd?.()
            }
        },
        {
            root: viewport?.root,
            margin: viewport?.margin as never,
            amount: viewport?.amount ?? 0
        }
    )

    return stop
}

/**
 * Options accepted by `useInView`.
 */
export type UseInViewOptions = {
    /** Element to use as the IntersectionObserver root. Defaults to the viewport. */
    root?: ElementOrGetter
    /** CSS margin string applied to the root bounding box (e.g. `"100px 0px"`). */
    margin?: string
    /** Fraction (0-1) or `"some"` / `"all"` of the target that must be visible. */
    amount?: 'some' | 'all' | number
    /** When `true`, the state latches to `true` on first entry and never flips back. */
    once?: boolean
    /** Initial value emitted before the first IntersectionObserver callback. */
    initial?: boolean
}

/**
 * State returned by {@link useInView}.
 */
export type InViewState = BooleanSnapshot

/**
 * Returns an `InViewState` that tracks whether `target` is in the viewport.
 * Mirrors framer-motion's `useInView` adapted for Svelte 5 runes.
 *
 * `target` (and `options.root`) accept either an `HTMLElement` directly or
 * a getter `() => HTMLElement | undefined`. With Svelte's `bind:this` the
 * element isn't available until after mount, so element resolution is
 * deferred — if the element isn't ready, the hook polls on
 * `requestAnimationFrame` until it is.
 *
 * Lifecycle: the IntersectionObserver is bound to the surrounding reactive
 * scope via `$effect`. The observer attaches at mount and detaches at
 * unmount, regardless of how many consumers are reading `.current` or
 * `.subscribe()`. This is a deliberate divergence from the previous
 * store-based impl, which attached lazily on first subscribe.
 *
 * SSR-safe: returns a static `{ current: options.initial ?? false }` when
 * `window` or `IntersectionObserver` is unavailable.
 *
 * @param target - Element (or getter) to observe.
 * @param options - Optional `UseInViewOptions` (`root`, `margin`, `amount`,
 *   `once`, `initial`).
 * @returns A `InViewState` reflecting the target's viewport intersection.
 * @see https://motion.dev/docs/react-use-in-view
 *
 * @example
 * ```svelte
 * <script>
 *   import { useInView } from '@humanspeak/svelte-motion'
 *
 *   let ref
 *   const inView = useInView(() => ref, { once: true })
 *
 *   $effect(() => {
 *     if (inView.current) trackImpression()
 *   })
 * </script>
 *
 * <div bind:this={ref}>{inView.current ? 'visible' : 'hidden'}</div>
 * ```
 */
export const useInView = (target: ElementOrGetter, options: UseInViewOptions = {}): InViewState => {
    const initial = options.initial ?? false

    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
        return {
            get current() {
                return initial
            },
            subscribe(run) {
                run(initial)
                return () => undefined
            }
        }
    }

    const [state, set] = createBooleanSnapshot(initial)
    let latched = false

    const attachable = createAttachable({
        refs: { target, root: options.root },
        isLatched: () => latched,
        onAttach: ({ target: el, root }, stop) =>
            motionInView(
                el!,
                () => {
                    set(true)
                    if (options.once) {
                        // Detach inside the entry callback; motion's inView
                        // handles re-entry safely via observer.unobserve.
                        latched = true
                        stop()
                        return
                    }
                    return () => set(false)
                },
                {
                    root: root as Element | Document | undefined,
                    // framer-motion types `margin` as a CSS-shorthand template
                    // literal; we expose plain `string` so the public API is
                    // ergonomic and forward-compat with future motion changes.
                    margin: options.margin as never,
                    amount: options.amount
                }
            )
    })

    $effect(() => attachable.subscribe())

    return state
}
