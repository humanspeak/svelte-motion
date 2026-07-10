import {
    buildGestureTransform,
    collectGestureTransformValues,
    type GestureTransformValues
} from '$lib/utils/transformComposer'
import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'
import { animateValue, hover, type TransformTemplate } from 'motion-dom'

/**
 * Determine whether the current environment supports true hover.
 *
 * Uses `(hover: hover)` and `(pointer: fine)` media queries to avoid sticky
 * hover states on touch devices.
 *
 * @param win Window object (useful for testing/mocking).
 * @return Whether the device supports hover with a fine pointer.
 */
export const isHoverCapable = (win: Window = window): boolean => {
    try {
        const mqHover = win.matchMedia('(hover: hover)')
        const mqPointerFine = win.matchMedia('(pointer: fine)')
        return mqHover.matches && mqPointerFine.matches
    } catch {
        return false
    }
}

/**
 * Split a hover definition into keyframes and an optional nested transition.
 *
 * @param def While-hover record that may include a nested `transition`.
 * @return Object with `keyframes` (no `transition`) and optional `transition`.
 */
export const splitHoverDefinition = (
    def: Record<string, unknown>
): {
    keyframes: Record<string, unknown>
    transition?: AnimationOptions
} => {
    const { transition, ...rest } = (def ?? {}) as { transition?: AnimationOptions }
    return { keyframes: rest, transition }
}

const readTransformScale = (el: HTMLElement): number => {
    const transform = getComputedStyle(el).transform
    if (!transform || transform === 'none') return 1
    const matrix = transform.match(/matrix\(([^)]+)\)/)
    if (!matrix) return 1

    const [a, b] = matrix[1].split(',').map((part) => Number.parseFloat(part.trim()))
    if (!Number.isFinite(a)) return 1
    if (!Number.isFinite(b)) return a
    return Math.hypot(a, b)
}

const getFinalNumber = (value: unknown): number | null => {
    const raw: unknown = Array.isArray(value) ? value[value.length - 1] : value
    const parsed = typeof raw === 'number' ? raw : Number.parseFloat(String(raw))
    return Number.isFinite(parsed) ? parsed : null
}

const toMillisecondsTransition = (
    transition: AnimationOptions | undefined
): Record<string, unknown> => {
    const valueTransition = { ...((transition ?? {}) as Record<string, unknown>) }
    for (const key of ['duration', 'delay', 'repeatDelay']) {
        if (typeof valueTransition[key] === 'number') {
            valueTransition[key] = valueTransition[key] * 1000
        }
    }
    return valueTransition
}

/**
 * Compute the baseline values to restore to on hover end.
 *
 * Preference order per key: `animate` → `initial` → neutral transform defaults
 * → computed style value if present.
 *
 * @param el Target element.
 * @param opts Source records for baseline computation.
 * @return Minimal baseline record to restore on hover end.
 */
export const computeHoverBaseline = (
    el: HTMLElement,
    opts: {
        initial?: Record<string, unknown>
        animate?: Record<string, unknown>
        whileHover?: Record<string, unknown>
    }
): Record<string, unknown> => {
    const baseline: Record<string, unknown> = {}
    const initialRecord = opts.initial ?? {}
    const animateRecord = opts.animate ?? {}
    const whileHoverRecordRaw = opts.whileHover ?? {}
    const whileHoverRecord = { ...whileHoverRecordRaw } as Record<string, unknown>
    delete whileHoverRecord.transition

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

    for (const key of Object.keys(whileHoverRecord)) {
        if (Object.prototype.hasOwnProperty.call(animateRecord, key)) {
            baseline[key] = animateRecord[key]
        } else if (Object.prototype.hasOwnProperty.call(initialRecord, key)) {
            baseline[key] = initialRecord[key]
        } else if (key in neutralTransformDefaults) {
            baseline[key] = neutralTransformDefaults[key]
        } else {
            // Check if inline style has a CSS variable for this property
            const inlineValue = getInlineStyleValue(key)
            if (inlineValue) {
                baseline[key] = inlineValue
            } else if (key in (cs as unknown as Record<string, unknown>)) {
                baseline[key] = (cs as unknown as Record<string, unknown>)[key]
            }
        }
    }
    return baseline
}

type HoverTransformComposerOptions = {
    getBaseTransformValues?: () => GestureTransformValues
    getLiveTransformValues?: () => GestureTransformValues | null
    getBaseTransform?: () => string
    transformTemplate?: TransformTemplate
}

/**
 * Attach whileHover interactions to an element with capability gating.
 *
 * Uses motion-dom's hover function which filters out touch events and interoperates
 * with drag gestures. On pointer enter, animates to `whileHover` (using nested `transition`
 * if provided). On leave, restores changed keys to the baseline using the merged
 * root/component transition.
 *
 * @param el Target element.
 * @param whileHover While-hover definition.
 * @param mergedTransition Root/component merged transition.
 * @param callbacks Optional lifecycle callbacks for hover start/end.
 * @param baselineSources Optional sources used to compute baseline.
 * @param transformComposer Optional shared transform sources used by scale animation.
 * @return Cleanup function to remove hover listeners.
 */
export const attachWhileHover = (
    el: HTMLElement,
    whileHover: Record<string, unknown> | undefined,
    mergedTransition: AnimationOptions,
    callbacks?: { onStart?: () => void; onEnd?: () => void },
    baselineSources?: { initial?: Record<string, unknown>; animate?: Record<string, unknown> },
    transformComposer?: HoverTransformComposerOptions
): (() => void) => {
    if (!whileHover) return () => {}

    let hoverBaseline: Record<string, unknown> | null = null
    let scaleAnimation: { stop?: () => void } | null = null
    let fallbackBaseTransform = ''
    const restingTransformValues: GestureTransformValues = {
        ...collectGestureTransformValues(baselineSources?.initial),
        ...collectGestureTransformValues(baselineSources?.animate)
    }

    const writeComposedScale = (scale: number) => {
        const transform =
            buildGestureTransform(
                {
                    ...(transformComposer?.getBaseTransformValues?.() ?? {}),
                    ...restingTransformValues,
                    ...(transformComposer?.getLiveTransformValues?.() ?? {}),
                    scale
                },
                transformComposer?.getBaseTransform?.() ?? fallbackBaseTransform,
                transformComposer?.transformTemplate
            ) || 'none'
        el.style.transform = transform
    }

    const stopScaleAnimation = () => {
        scaleAnimation?.stop?.()
        scaleAnimation = null
    }

    const animateScale = (
        target: unknown,
        transition: AnimationOptions | undefined,
        onComplete?: () => void
    ) => {
        const targetScale = getFinalNumber(target)
        if (targetScale == null) {
            onComplete?.()
            return
        }

        stopScaleAnimation()
        scaleAnimation = animateValue({
            ...toMillisecondsTransition(transition ?? mergedTransition),
            keyframes: [readTransformScale(el), targetScale],
            onUpdate: (value: number) => {
                writeComposedScale(value)
            },
            onComplete: () => {
                writeComposedScale(targetScale)
                scaleAnimation = null
                onComplete?.()
            }
        })
    }

    const handleDragStart = () => stopScaleAnimation()
    el.addEventListener('svelte-motion:drag-start', handleDragStart)

    const cleanupHover = hover(el, () => {
        if (el.dataset.svelteMotionDragActive === 'true') return () => {}

        // Hover start: compute baseline and animate to whileHover values
        hoverBaseline = computeHoverBaseline(el, {
            initial: baselineSources?.initial,
            animate: baselineSources?.animate,
            whileHover
        })
        fallbackBaseTransform = transformComposer ? '' : el.style.transform
        callbacks?.onStart?.()
        const { keyframes, transition } = splitHoverDefinition(whileHover)
        const { scale, ...nativeKeyframes } = keyframes
        if (scale != null) animateScale(scale, transition)
        if (Object.keys(nativeKeyframes).length > 0) {
            animate(
                el,
                nativeKeyframes as unknown as DOMKeyframesDefinition,
                transition ?? mergedTransition
            )
        }

        // Return cleanup function for hover end
        return () => {
            // Hover end: restore baseline values
            if (hoverBaseline && Object.keys(hoverBaseline).length > 0) {
                const { scale: baselineScale, ...nativeBaseline } = hoverBaseline
                if (baselineScale != null) animateScale(baselineScale, mergedTransition)
                if (Object.keys(nativeBaseline).length > 0) {
                    animate(
                        el,
                        nativeBaseline as unknown as DOMKeyframesDefinition,
                        mergedTransition
                    )
                }
            }
            callbacks?.onEnd?.()
        }
    })

    return () => {
        stopScaleAnimation()
        el.removeEventListener('svelte-motion:drag-start', handleDragStart)
        cleanupHover()
    }
}
