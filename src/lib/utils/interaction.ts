import type { DOMKeyframesDefinition } from 'motion'
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
    callbacks?: { onTapStart?: () => void; onTap?: () => void; onTapCancel?: () => void }
): (() => void) => {
    if (!whileTap) return () => {}

    const handlePointerDown = () => {
        callbacks?.onTapStart?.()
        animate(el, whileTap as unknown as DOMKeyframesDefinition)
    }
    const handlePointerUp = () => {
        callbacks?.onTap?.()
        if (!whileTap) return
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

    el.addEventListener('pointerdown', handlePointerDown)
    el.addEventListener('pointerup', handlePointerUp)
    el.addEventListener('pointercancel', handlePointerCancel)

    return () => {
        el.removeEventListener('pointerdown', handlePointerDown)
        el.removeEventListener('pointerup', handlePointerUp)
        el.removeEventListener('pointercancel', handlePointerCancel)
    }
}
