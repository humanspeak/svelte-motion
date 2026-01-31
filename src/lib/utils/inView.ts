import { type AnimationOptions, type DOMKeyframesDefinition, animate } from 'motion'

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
    const inlineStyle = el.getAttribute('style') || ''

    // Helper to escape regex metacharacters to prevent ReDoS and ensure literal matching
    const escapeRegExp = (str: string): string => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    // Helper to extract CSS function (var, calc, min, max, etc.) from inline style if present
    const getInlineStyleValue = (propName: string): string | null => {
        const kebabCase = propName.replace(/([A-Z])/g, '-$1').toLowerCase()
        const escapedKebabCase = escapeRegExp(kebabCase)
        // Match property name at start of string or after semicolon
        const regex = new RegExp(`(?:^|;)\\s*${escapedKebabCase}\\s*:\\s*([^;]+)`, 'i')
        const match = inlineStyle.match(regex)
        if (match) {
            const value = match[1].trim()
            // Preserve CSS functions: var(), calc(), min(), max(), clamp(), rgb(), hsl(), url(), etc.
            if (/\b(var|calc|min|max|clamp|rgb|rgba|hsl|hsla|url)\s*\(/.test(value)) {
                return value
            }
        }
        return null
    }

    for (const key of Object.keys(whileInViewRecord)) {
        if (Object.prototype.hasOwnProperty.call(animateRecord, key)) {
            baseline[key] = animateRecord[key]
        } else if (Object.prototype.hasOwnProperty.call(initialRecord, key)) {
            baseline[key] = initialRecord[key]
        } else if (key in (neutralTransformDefaults as Record<string, unknown>)) {
            baseline[key] = neutralTransformDefaults[key]
        } else {
            // Check if inline style has a CSS variable for this property
            const inlineValue = getInlineStyleValue(key)
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
 * Attach whileInView interactions to an element using IntersectionObserver.
 *
 * On intersection (element enters viewport), animates to `whileInView` state
 * (using nested `transition` if provided). On un-intersection, restores changed
 * keys to the baseline using the merged root/component transition.
 *
 * Critical fix for issue #230: Checks `entry.isIntersecting` immediately on
 * first callback to handle elements already in viewport on mount.
 *
 * @param el Target element.
 * @param whileInView While-in-view definition.
 * @param mergedTransition Root/component merged transition.
 * @param callbacks Optional lifecycle callbacks for in-view start/end and animation completion.
 * @param baselineSources Optional sources used to compute baseline.
 * @returns Cleanup function to disconnect the IntersectionObserver.
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
 * // Later: cleanup() to disconnect observer
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

    let hasAnimated = false
    let inViewBaseline: Record<string, unknown> | null = null

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting && !hasAnimated) {
                    // Element entered viewport: animate to whileInView state
                    hasAnimated = true
                    inViewBaseline = computeInViewBaseline(el, {
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
                    // Call onAnimationComplete when animation finishes
                    animation.finished
                        .then(() => {
                            callbacks?.onAnimationComplete?.(
                                keyframes as unknown as DOMKeyframesDefinition
                            )
                        })
                        .catch(() => {
                            // Animation was cancelled, don't call completion callback
                        })
                } else if (!entry.isIntersecting && hasAnimated) {
                    // Element left viewport: animate back to baseline
                    if (inViewBaseline && Object.keys(inViewBaseline).length > 0) {
                        animate(
                            el,
                            inViewBaseline as unknown as DOMKeyframesDefinition,
                            mergedTransition
                        )
                    }
                    callbacks?.onEnd?.()
                    hasAnimated = false
                }
            }
        },
        { threshold: 0 } // Fire as soon as any part is visible
    )

    // Start observing - IntersectionObserver fires immediately for already-visible elements
    observer.observe(el)

    // Return cleanup function
    return () => {
        observer.disconnect()
    }
}
