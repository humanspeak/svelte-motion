import {
    animate,
    inView as motionInView,
    type AnimationOptions,
    type DOMKeyframesDefinition
} from 'motion'
import { readable, writable, type Readable } from 'svelte/store'
import { createAttachable } from './attachable.js'
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
 * @example
 * getInlineCssFunction(node, 'background') // => 'var(--brand)' | null
 */
const getInlineCssFunction = (el: HTMLElement, propName: string): string | null => {
    const kebab = propName.replace(/([A-Z])/g, '-$1').toLowerCase()
    const value = el.style.getPropertyValue(kebab).trim()
    if (!value) return null
    return CSS_FUNCTION_RE.test(value) ? value : null
}

/**
 * Split a whileInView definition into keyframes and an optional nested transition.
 *
 * @param def While-in-view record that may include a nested `transition`.
 * @returns Object with `keyframes` (no `transition`) and optional `transition`.
 * @example
 * // With transition
 * splitInViewDefinition({ opacity: 1, y: 0, transition: { duration: 0.5 } })
 * // => { keyframes: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }
 *
 * @example
 * // Without transition
 * splitInViewDefinition({ opacity: 1, scale: 1 })
 * // => { keyframes: { opacity: 1, scale: 1 }, transition: undefined }
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
 * Compute the baseline values to restore to when element leaves viewport.
 *
 * Preference order per key: `animate` → `initial` → neutral transform defaults
 * → computed style value if present.
 *
 * @param el Target element.
 * @param opts Source records for baseline computation.
 * @returns Minimal baseline record to restore when element leaves viewport.
 * @example
 * computeInViewBaseline(element, {
 *   initial: { opacity: 0, y: 50 },
 *   animate: { opacity: 1, y: 0 },
 *   whileInView: { opacity: 1, scale: 1.1 }
 * })
 * // => { opacity: 1, scale: 1 } (scale defaults to 1, opacity from animate)
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
 * Attach whileInView interactions to an element via motion's `inView` primitive.
 *
 * On entry, animates to `whileInView` state (using the nested `transition` if
 * provided). On exit, restores the changed keys to a baseline computed from
 * `initial` / `animate` / neutral transform defaults / inline styles.
 *
 * Delegates to motion's `inView` so the IntersectionObserver implementation
 * is shared with the public `useInView` hook.
 *
 * @param el Target element.
 * @param whileInView While-in-view definition.
 * @param mergedTransition Root/component merged transition.
 * @param callbacks Optional lifecycle callbacks for in-view start/end and animation completion.
 * @param baselineSources Optional sources used to compute baseline.
 * @returns Cleanup function to stop observing.
 * @example
 * const cleanup = attachWhileInView(
 *   element,
 *   { opacity: 1, y: 0, transition: { duration: 0.5 } },
 *   { duration: 0.3 },
 *   {
 *     onStart: () => console.log('Entered viewport'),
 *     onEnd: () => console.log('Left viewport')
 *   },
 *   { initial: { opacity: 0, y: 50 } }
 * )
 * // Later: cleanup() to stop observing
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
    baselineSources?: { initial?: Record<string, unknown>; animate?: Record<string, unknown> }
): (() => void) => {
    if (!whileInView) return () => {}

    return motionInView(
        el,
        () => {
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
        { amount: 0 }
    )
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
    /** When `true`, the store latches to `true` on first entry and never flips back. */
    once?: boolean
    /** Initial value emitted before the first IntersectionObserver callback. */
    initial?: boolean
}

/**
 * Returns a Svelte readable store that tracks whether `target` is in the
 * viewport. Mirrors Framer Motion's `useInView` so the same options
 * (`root`, `margin`, `amount`, `once`, `initial`) work as in React.
 *
 * `target` (and `options.root`) accept either an `HTMLElement` directly or a
 * getter `() => HTMLElement | undefined`. With Svelte's `bind:this`, the
 * element isn't available until after mount, so element resolution is
 * deferred until the first subscriber arrives; if the element isn't ready,
 * the hook polls on `requestAnimationFrame` until it is.
 *
 * SSR-safe: returns a static `readable(initial)` when `window` or
 * `IntersectionObserver` is unavailable.
 *
 * @param target - Element (or getter) to observe.
 * @param options - Optional `UseInViewOptions` (`root`, `margin`, `amount`,
 *   `once`, `initial`).
 * @returns A `Readable<boolean>` that flips to `true` while `target` is in view.
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
 *     if ($inView) trackImpression()
 *   })
 * </script>
 *
 * <div bind:this={ref}>{$inView ? 'visible' : 'hidden'}</div>
 * ```
 */
export const useInView = (
    target: ElementOrGetter,
    options: UseInViewOptions = {}
): Readable<boolean> => {
    const initial = options.initial ?? false
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
        return readable(initial)
    }

    const store = writable<boolean>(initial)
    let current = initial
    const update = (next: boolean) => {
        if (next === current) return
        current = next
        store.set(next)
    }

    let latched = false

    const attachable = createAttachable({
        refs: { target, root: options.root },
        isLatched: () => latched,
        onAttach: ({ target: el, root }, stop) =>
            motionInView(
                el!,
                () => {
                    update(true)
                    if (options.once) {
                        // Detach inside the entry callback; motion's inView
                        // handles re-entry safely via observer.unobserve.
                        latched = true
                        stop()
                        return
                    }
                    return () => update(false)
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

    return readable(initial, (set) => {
        const release = attachable.subscribe()
        const unsub = store.subscribe(set)
        return () => {
            unsub()
            release()
        }
    })
}
