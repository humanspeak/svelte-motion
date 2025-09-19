import { isHoverCapable, splitHoverDefinition } from '$lib/utils/hover'
import type { AnimationOptions, DOMKeyframesDefinition } from 'motion'
import { animate } from 'motion'

/**
 * Build a reset record for whileTap on pointerup.
 *
 * For each key present in `whileTap`, this returns the value from `animate`
 * if provided, otherwise from `initial`. Keys not present in `whileTap` are
 * omitted to avoid unintended style changes.
 *
 * @param initial Initial keyframe record.
 * @param animateDef Animate keyframe record.
 * @param whileTap While-tap keyframe record.
 * @return Minimal record to restore post-tap values.
 */
export const buildTapResetRecord = (
    initial: Record<string, unknown>,
    animateDef: Record<string, unknown>,
    whileTap: Record<string, unknown>
): Record<string, unknown> => {
    const keys = new Set<string>([...Object.keys(initial ?? {}), ...Object.keys(animateDef ?? {})])
    const overlappingKeys: string[] = []
    for (const k of keys) if (k in (whileTap ?? {})) overlappingKeys.push(k)

    const resetRecord: Record<string, unknown> = {}
    for (const k of overlappingKeys) {
        resetRecord[k] = Object.prototype.hasOwnProperty.call(animateDef ?? {}, k)
            ? animateDef[k]
            : initial[k]
    }
    return resetRecord
}

/**
 * Attach whileTap interactions to an element.
 *
 * On `pointerdown`, animates to the whileTap definition. On `pointerup` or
 * `pointercancel`, restores overlapping keys back to the animate-or-initial
 * baseline.
 *
 * @param el Element to attach listeners to.
 * @param whileTap While-tap keyframe record.
 * @param initial Initial keyframe record.
 * @param animateDef Animate keyframe record.
 * @return Cleanup function to remove listeners.
 */
export const attachWhileTap = (
    el: HTMLElement,
    whileTap: Record<string, unknown> | undefined,
    initial?: Record<string, unknown>,
    animateDef?: Record<string, unknown>,
    callbacks?: {
        onTapStart?: () => void
        onTap?: () => void
        onTapCancel?: () => void
        hoverDef?: Record<string, unknown> | undefined
        hoverFallbackTransition?: AnimationOptions | undefined
    }
): (() => void) => {
    if (!whileTap) return () => {}

    let keyboardActive = false

    const handlePointerDown = () => {
        callbacks?.onTapStart?.()
        animate(el, whileTap as unknown as DOMKeyframesDefinition)
    }
    const reapplyHoverIfActive = () => {
        if (!callbacks?.hoverDef) return false
        if (!isHoverCapable()) return false
        try {
            if (!el.matches(':hover')) return false
        } catch {
            return false
        }
        const { keyframes, transition } = splitHoverDefinition(
            callbacks.hoverDef as Record<string, unknown>
        )
        animate(
            el,
            keyframes as unknown as DOMKeyframesDefinition,
            (transition ?? callbacks.hoverFallbackTransition) as AnimationOptions
        )
        return true
    }

    const handlePointerUp = () => {
        callbacks?.onTap?.()
        if (!whileTap) return
        if (reapplyHoverIfActive()) return
        if (initial || animateDef) {
            const resetRecord = buildTapResetRecord(initial ?? {}, animateDef ?? {}, whileTap ?? {})
            if (Object.keys(resetRecord).length > 0) {
                animate(el, resetRecord as unknown as DOMKeyframesDefinition)
            }
        }
    }
    const handlePointerCancel = () => {
        callbacks?.onTapCancel?.()
        // On cancel, also restore baseline if available
        if (initial || animateDef) {
            const resetRecord = buildTapResetRecord(initial ?? {}, animateDef ?? {}, whileTap ?? {})
            if (Object.keys(resetRecord).length > 0) {
                animate(el, resetRecord as unknown as DOMKeyframesDefinition)
            }
        }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (!(e.key === 'Enter' || e.key === ' ' || e.key === 'Space')) return
        // Prevent page scroll/activation for Space
        if (e.key === ' ' || e.key === 'Space') e.preventDefault?.()
        if (keyboardActive) return
        keyboardActive = true
        callbacks?.onTapStart?.()
        animate(el, whileTap as unknown as DOMKeyframesDefinition)
    }

    const handleKeyUp = (e: KeyboardEvent) => {
        if (!(e.key === 'Enter' || e.key === ' ' || e.key === 'Space')) return
        // Prevent page scroll/activation for Space
        if (e.key === ' ' || e.key === 'Space') e.preventDefault?.()
        if (!keyboardActive) return
        keyboardActive = false
        callbacks?.onTap?.()
        if (reapplyHoverIfActive()) return
        if (initial || animateDef) {
            const resetRecord = buildTapResetRecord(initial ?? {}, animateDef ?? {}, whileTap ?? {})
            if (Object.keys(resetRecord).length > 0) {
                animate(el, resetRecord as unknown as DOMKeyframesDefinition)
            }
        }
    }

    const handleBlur = () => {
        if (!keyboardActive) return
        keyboardActive = false
        callbacks?.onTapCancel?.()
        if (initial || animateDef) {
            const resetRecord = buildTapResetRecord(initial ?? {}, animateDef ?? {}, whileTap ?? {})
            if (Object.keys(resetRecord).length > 0) {
                animate(el, resetRecord as unknown as DOMKeyframesDefinition)
            }
        }
    }

    el.addEventListener('pointerdown', handlePointerDown)
    el.addEventListener('pointerup', handlePointerUp)
    el.addEventListener('pointercancel', handlePointerCancel)
    el.addEventListener('keydown', handleKeyDown)
    el.addEventListener('keyup', handleKeyUp)
    el.addEventListener('blur', handleBlur)

    return () => {
        el.removeEventListener('pointerdown', handlePointerDown)
        el.removeEventListener('pointerup', handlePointerUp)
        el.removeEventListener('pointercancel', handlePointerCancel)
        el.removeEventListener('keydown', handleKeyDown)
        el.removeEventListener('keyup', handleKeyUp)
        el.removeEventListener('blur', handleBlur)
    }
}
