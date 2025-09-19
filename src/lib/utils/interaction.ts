import type { DOMKeyframesDefinition } from 'motion'
import { animate } from 'motion'

export function buildTapResetRecord(
    initial: Record<string, unknown>,
    animateDef: Record<string, unknown>,
    whileTap: Record<string, unknown>
): Record<string, unknown> {
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

export function attachWhileTap(
    el: HTMLElement,
    whileTap: Record<string, unknown> | undefined,
    initial?: Record<string, unknown>,
    animateDef?: Record<string, unknown>
): () => void {
    if (!whileTap) return () => {}

    const handlePointerDown = () => {
        animate(el, whileTap as unknown as DOMKeyframesDefinition)
    }
    const handlePointerUp = () => {
        if (!whileTap) return
        if (initial || animateDef) {
            const resetRecord = buildTapResetRecord(initial ?? {}, animateDef ?? {}, whileTap ?? {})
            if (Object.keys(resetRecord).length > 0) {
                animate(el, resetRecord as unknown as DOMKeyframesDefinition)
            }
        }
    }

    el.addEventListener('pointerdown', handlePointerDown)
    el.addEventListener('pointerup', handlePointerUp)
    el.addEventListener('pointercancel', handlePointerUp)

    return () => {
        el.removeEventListener('pointerdown', handlePointerDown)
        el.removeEventListener('pointerup', handlePointerUp)
        el.removeEventListener('pointercancel', handlePointerUp)
    }
}
