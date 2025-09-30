import { type AnimationOptions, type DOMKeyframesDefinition, animate } from 'motion'

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
    const initialRecord = (opts.initial ?? {}) as Record<string, unknown>
    const animateRecord = (opts.animate ?? {}) as Record<string, unknown>
    const whileHoverRecordRaw = (opts.whileHover ?? {}) as Record<string, unknown>
    const whileHoverRecord = { ...whileHoverRecordRaw } as Record<string, unknown>
    delete (whileHoverRecord as Record<string, unknown>).transition

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
    for (const key of Object.keys(whileHoverRecord)) {
        if (Object.prototype.hasOwnProperty.call(animateRecord, key)) {
            baseline[key] = animateRecord[key]
        } else if (Object.prototype.hasOwnProperty.call(initialRecord, key)) {
            baseline[key] = initialRecord[key]
        } else if (key in (neutralTransformDefaults as Record<string, unknown>)) {
            baseline[key] = neutralTransformDefaults[key]
        } else if (key in (cs as unknown as Record<string, unknown>)) {
            baseline[key] = (cs as unknown as Record<string, unknown>)[key] as string
        }
    }
    return baseline
}

/**
 * Attach whileHover interactions to an element with capability gating.
 *
 * On pointer enter, animates to `whileHover` (using nested `transition` if
 * provided). On leave, restores changed keys to the baseline using the merged
 * root/component transition.
 *
 * @param el Target element.
 * @param whileHover While-hover definition.
 * @param mergedTransition Root/component merged transition.
 * @param callbacks Optional lifecycle callbacks for hover start/end.
 * @param isCapable Capability predicate (override for testing).
 * @param baselineSources Optional sources used to compute baseline.
 * @return Cleanup function to remove listeners.
 */
export const attachWhileHover = (
    el: HTMLElement,
    whileHover: Record<string, unknown> | undefined,
    mergedTransition: AnimationOptions,
    callbacks?: { onStart?: () => void; onEnd?: () => void },
    isCapable: () => boolean = () => isHoverCapable(),
    baselineSources?: { initial?: Record<string, unknown>; animate?: Record<string, unknown> }
): (() => void) => {
    if (!whileHover) return () => {}

    let hoverBaseline: Record<string, unknown> | null = null

    const handlePointerEnter = () => {
        if (!isCapable()) return
        // Don't cancel - let Motion interrupt smoothly from current value
        hoverBaseline = computeHoverBaseline(el, {
            initial: baselineSources?.initial,
            animate: baselineSources?.animate,
            whileHover
        })
        callbacks?.onStart?.()
        const { keyframes, transition } = splitHoverDefinition(whileHover)
        animate(
            el,
            keyframes as unknown as DOMKeyframesDefinition,
            (transition ?? mergedTransition) as AnimationOptions
        )
    }

    const handlePointerLeave = () => {
        if (!isCapable()) return
        // Don't cancel - let Motion interrupt smoothly from current value
        if (hoverBaseline && Object.keys(hoverBaseline).length > 0) {
            animate(el, hoverBaseline as unknown as DOMKeyframesDefinition, mergedTransition)
        }
        callbacks?.onEnd?.()
    }

    el.addEventListener('pointerenter', handlePointerEnter)
    el.addEventListener('pointerleave', handlePointerLeave)

    return () => {
        el.removeEventListener('pointerenter', handlePointerEnter)
        el.removeEventListener('pointerleave', handlePointerLeave)
    }
}
