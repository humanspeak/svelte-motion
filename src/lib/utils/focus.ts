import { type AnimationOptions, type DOMKeyframesDefinition, animate } from 'motion'

/**
 * Split a focus definition into keyframes and an optional nested transition.
 *
 * @param def While-focus record that may include a nested `transition`.
 * @returns Object with `keyframes` (no `transition`) and optional `transition`.
 */
export const splitFocusDefinition = (
    def: Record<string, unknown>
): {
    keyframes: Record<string, unknown>
    transition?: AnimationOptions
} => {
    const { transition, ...rest } = (def ?? {}) as { transition?: AnimationOptions }
    return { keyframes: rest, transition }
}

/**
 * Compute the baseline values to restore to on focus end.
 *
 * Preference order per key: `animate` → `initial` → neutral transform defaults.
 *
 * @param el Target element.
 * @param opts Source records for baseline computation.
 * @returns Minimal baseline record to restore on focus end.
 */
export const computeFocusBaseline = (
    el: HTMLElement,
    opts: {
        initial?: Record<string, unknown>
        animate?: Record<string, unknown>
        whileFocus?: Record<string, unknown>
    }
): Record<string, unknown> => {
    const baseline: Record<string, unknown> = {}
    const initialRecord = (opts.initial ?? {}) as Record<string, unknown>
    const animateRecord = (opts.animate ?? {}) as Record<string, unknown>
    const whileFocusRecordRaw = (opts.whileFocus ?? {}) as Record<string, unknown>
    const whileFocusRecord = { ...whileFocusRecordRaw } as Record<string, unknown>
    delete (whileFocusRecord as Record<string, unknown>).transition

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

    for (const key of Object.keys(whileFocusRecord)) {
        if (Object.prototype.hasOwnProperty.call(animateRecord, key)) {
            baseline[key] = animateRecord[key]
        } else if (Object.prototype.hasOwnProperty.call(initialRecord, key)) {
            baseline[key] = initialRecord[key]
        } else if (key in (neutralTransformDefaults as Record<string, unknown>)) {
            baseline[key] = neutralTransformDefaults[key]
        } else {
            // Convert camelCase to kebab-case for CSS property access
            const cssProperty = key.replace(/([A-Z])/g, '-$1').toLowerCase()
            const value = cs.getPropertyValue(cssProperty)
            // Always assign a baseline entry to ensure a removal keyframe exists.
            if (value) {
                baseline[key] = value
            } else {
                // Fallback to inline style for that property, else explicit empty string
                const inlineValue = el.style.getPropertyValue(cssProperty)
                baseline[key] = inlineValue || ''
            }
        }
    }
    return baseline
}

/**
 * Attach whileFocus interactions to an element.
 *
 * On focus, animates to `whileFocus` (using nested `transition` if provided).
 * On blur, restores changed keys to the baseline using the merged transition.
 *
 * @param el Target element.
 * @param whileFocus While-focus definition.
 * @param mergedTransition Root/component merged transition.
 * @param callbacks Optional lifecycle callbacks for focus start/end.
 * @param baselineSources Optional sources used to compute baseline.
 * @returns Cleanup function to remove listeners.
 */
export const attachWhileFocus = (
    el: HTMLElement,
    whileFocus: Record<string, unknown> | undefined,
    mergedTransition: AnimationOptions,
    callbacks?: { onStart?: () => void; onEnd?: () => void },
    baselineSources?: { initial?: Record<string, unknown>; animate?: Record<string, unknown> }
): (() => void) => {
    if (!whileFocus) return () => {}

    let focusBaseline: Record<string, unknown> | null = null

    const handleFocus = () => {
        focusBaseline = computeFocusBaseline(el, {
            initial: baselineSources?.initial,
            animate: baselineSources?.animate,
            whileFocus
        })
        callbacks?.onStart?.()
        const { keyframes, transition } = splitFocusDefinition(whileFocus)
        animate(
            el,
            keyframes as unknown as DOMKeyframesDefinition,
            (transition ?? mergedTransition) as AnimationOptions
        )
    }

    const handleBlur = () => {
        if (focusBaseline && Object.keys(focusBaseline).length > 0) {
            const baselineForAnimation = { ...focusBaseline } as Record<string, unknown>
            // For baseline entries that are empty string, proactively clear inline CSS
            for (const [key, v] of Object.entries(baselineForAnimation)) {
                if (v === '') {
                    const cssProperty = key.replace(/([A-Z])/g, '-$1').toLowerCase()
                    el.style.removeProperty(cssProperty)
                }
            }
            animate(el, baselineForAnimation as unknown as DOMKeyframesDefinition, mergedTransition)
        }
        callbacks?.onEnd?.()
    }

    el.addEventListener('focus', handleFocus)
    el.addEventListener('blur', handleBlur)

    return () => {
        el.removeEventListener('focus', handleFocus)
        el.removeEventListener('blur', handleBlur)
    }
}
