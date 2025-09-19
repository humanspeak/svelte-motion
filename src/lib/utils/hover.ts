import type { AnimationOptions, DOMKeyframesDefinition } from 'motion'
import { animate } from 'motion'

export function isHoverCapable(win: Window = window): boolean {
    try {
        const mqHover = win.matchMedia('(hover: hover)')
        const mqPointerFine = win.matchMedia('(pointer: fine)')
        return mqHover.matches && mqPointerFine.matches
    } catch {
        return false
    }
}

export function splitHoverDefinition(def: Record<string, unknown>): {
    keyframes: Record<string, unknown>
    transition?: AnimationOptions
} {
    const { transition, ...rest } = (def ?? {}) as { transition?: AnimationOptions }
    return { keyframes: rest, transition }
}

export function computeHoverBaseline(
    el: HTMLElement,
    opts: {
        initial?: Record<string, unknown>
        animate?: Record<string, unknown>
        whileHover?: Record<string, unknown>
    }
): Record<string, unknown> {
    const baseline: Record<string, unknown> = {}
    const initialRecord = (opts.initial ?? {}) as Record<string, unknown>
    const animateRecord = (opts.animate ?? {}) as Record<string, unknown>
    const whileHoverRecordRaw = (opts.whileHover ?? {}) as Record<string, unknown>
    const whileHoverRecord = { ...whileHoverRecordRaw }
    delete (whileHoverRecord as Record<string, unknown>)['transition']

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
        skewY: 0
    }

    const cs = getComputedStyle(el)
    for (const key of Object.keys(whileHoverRecord)) {
        if (Object.prototype.hasOwnProperty.call(animateRecord, key)) {
            baseline[key] = animateRecord[key]
        } else if (Object.prototype.hasOwnProperty.call(initialRecord, key)) {
            baseline[key] = initialRecord[key]
        } else if (key in neutralTransformDefaults) {
            baseline[key] = neutralTransformDefaults[key]
        } else if (key in (cs as unknown as Record<string, unknown>)) {
            baseline[key] = (cs as unknown as Record<string, unknown>)[key] as string
        }
    }
    return baseline
}

export function attachWhileHover(
    el: HTMLElement,
    whileHover: Record<string, unknown> | undefined,
    mergedTransition: AnimationOptions,
    callbacks?: { onStart?: () => void; onEnd?: () => void },
    isCapable: () => boolean = () => isHoverCapable(),
    baselineSources?: { initial?: Record<string, unknown>; animate?: Record<string, unknown> }
): () => void {
    if (!whileHover) return () => {}

    let hoverBaseline: Record<string, unknown> | null = null

    const handlePointerEnter = () => {
        if (!isCapable()) return
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
        if (hoverBaseline && Object.keys(hoverBaseline).length > 0) {
            animate(
                el,
                hoverBaseline as unknown as DOMKeyframesDefinition,
                mergedTransition as AnimationOptions
            )
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
