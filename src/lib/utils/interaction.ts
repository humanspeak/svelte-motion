import { isHoverCapable, splitHoverDefinition } from '$lib/utils/hover'
import { pwLog } from '$lib/utils/log'
import { parseMatrixScale } from '$lib/utils/transform'
import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'

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
    // Reset any key that whileTap modified. Prefer animate > initial; otherwise provide safe defaults
    const overlappingKeys: string[] = Object.keys(whileTap ?? {})
    const resetRecord: Record<string, unknown> = {}
    const has = (rec: Record<string, unknown> | undefined, key: string) =>
        !!rec && Object.prototype.hasOwnProperty.call(rec, key)

    for (const k of overlappingKeys) {
        if (k === 'scale') {
            if (has(animateDef, 'scale')) resetRecord.scale = animateDef.scale
            else if (has(initial, 'scale')) resetRecord.scale = initial.scale
            else if (has(animateDef, 'scaleX') || has(animateDef, 'scaleY')) {
                const sx = (animateDef.scaleX as number | undefined) ?? 1
                const sy = (animateDef.scaleY as number | undefined) ?? 1
                resetRecord.scale = (sx + sy) / 2
            } else if (has(initial, 'scaleX') || has(initial, 'scaleY')) {
                const sx = (initial.scaleX as number | undefined) ?? 1
                const sy = (initial.scaleY as number | undefined) ?? 1
                resetRecord.scale = (sx + sy) / 2
            } else {
                resetRecord.scale = 1
            }
            continue
        }
        if (k === 'scaleX') {
            if (has(animateDef, 'scaleX')) resetRecord.scaleX = animateDef.scaleX
            else if (has(animateDef, 'scale')) resetRecord.scaleX = animateDef.scale
            else if (has(initial, 'scaleX')) resetRecord.scaleX = initial.scaleX
            else if (has(initial, 'scale')) resetRecord.scaleX = initial.scale
            else resetRecord.scaleX = 1
            continue
        }
        if (k === 'scaleY') {
            if (has(animateDef, 'scaleY')) resetRecord.scaleY = animateDef.scaleY
            else if (has(animateDef, 'scale')) resetRecord.scaleY = animateDef.scale
            else if (has(initial, 'scaleY')) resetRecord.scaleY = initial.scaleY
            else if (has(initial, 'scale')) resetRecord.scaleY = initial.scale
            else resetRecord.scaleY = 1
            continue
        }
        if (has(animateDef, k)) {
            resetRecord[k] = animateDef[k]
        } else if (has(initial, k)) {
            resetRecord[k] = initial[k]
        } else {
            resetRecord[k] = undefined as unknown as never
        }
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
    let activePointerId: number | null = null
    let tapCtl: Animation | null = null
    let resetCtl: Animation | null = null
    let baselineTransform: string | null = null
    const safetyGuards =
        typeof window !== 'undefined' &&
        (window as unknown as Record<string, unknown>)['SM_GESTURE_SAFE_GUARDS'] === true

    const computeCanonicalBaseline = (): string => {
        // Prefer animateDef > initial for transform-relevant keys when present, else computed style
        const scaleKeys = ['scale', 'scaleX', 'scaleY'] as const
        const from = (def?: Record<string, unknown>) =>
            def && scaleKeys.some((k) => Object.prototype.hasOwnProperty.call(def, k))
        if (from(animateDef)) {
            // If animate has scale keys, prefer matrix from current style (already at animate) as baseline
            const t = getComputedStyle(el).transform
            return t && t !== 'none' ? t : 'none'
        }
        if (from(initial)) {
            const t = getComputedStyle(el).transform
            return t && t !== 'none' ? t : 'none'
        }
        const t = getComputedStyle(el).transform
        return t || 'none'
    }

    const handlePointerDown = (event: PointerEvent) => {
        // Capture pointer so we receive up/cancel even if pointer leaves the element
        if (typeof event.pointerId === 'number') {
            try {
                if ('setPointerCapture' in el) {
                    el.setPointerCapture(event.pointerId)
                }
            } catch {
                // noop if not supported
            }
            activePointerId = event.pointerId
            // Attach global listeners to catch off-element releases (even if capture unsupported)
            window.addEventListener('pointerup', handlePointerUp as EventListener)
            window.addEventListener('pointercancel', handlePointerCancel as EventListener)
            document.addEventListener('pointerup', handlePointerUp as EventListener)
            document.addEventListener('pointercancel', handlePointerCancel as EventListener)
        }
        const incomingScale = parseMatrixScale(getComputedStyle(el).transform) ?? 1
        pwLog('[tap] pointerdown', {
            w: el.getBoundingClientRect().width,
            h: el.getBoundingClientRect().height,
            transform: getComputedStyle(el).transform,
            incomingScale
        })
        // Cancel any in-flight reset and rebase to canonical baseline
        try {
            resetCtl?.cancel()
        } catch {
            // ignore
        }
        resetCtl = null
        if (!baselineTransform) baselineTransform = computeCanonicalBaseline()
        // Apply baseline immediately before whileTap
        if (baselineTransform && baselineTransform !== 'none')
            el.style.transform = baselineTransform
        else el.style.removeProperty('transform')

        // Software limit: if incoming scale is runaway, skip whileTap this cycle and force settle
        const baselineScale = parseMatrixScale(baselineTransform) ?? 1
        if (Math.abs(incomingScale) > Math.abs(baselineScale) * 1.3) {
            pwLog('[tap] runaway-detected-skip-whileTap', { incomingScale, baselineScale })
            callbacks?.onTapStart?.()
            tapCtl = null
            return
        }

        pwLog('[tap] whileTap-def', whileTap)
        callbacks?.onTapStart?.()
        // Cancel any existing tap animation before starting a new one
        try {
            tapCtl?.cancel()
        } catch {
            // ignore cancellation errors
        }
        tapCtl = animate(el, whileTap as unknown as DOMKeyframesDefinition) as unknown as Animation
        // Safety clamp for runaway scale
        if (safetyGuards) {
            const a =
                parseMatrixScale(getComputedStyle(el).transform) ??
                parseMatrixScale(el.style.transform)
            if (a !== null && Math.abs(a) > 8) {
                if (baselineTransform && baselineTransform !== 'none')
                    el.style.transform = baselineTransform
                else el.style.removeProperty('transform')
                pwLog('[tap] clamp-on-down', { a, restored: getComputedStyle(el).transform })
            }
        }
        Promise.resolve((tapCtl as unknown as { finished?: Promise<void> }).finished)
            .then(() =>
                pwLog('[tap] applied', {
                    w: el.getBoundingClientRect().width,
                    h: el.getBoundingClientRect().height,
                    transform: getComputedStyle(el).transform
                })
            )
            .catch(() => {})
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

    const handlePointerUp = (event: PointerEvent) => {
        if (typeof event.pointerId === 'number' && activePointerId !== null) {
            if (event.pointerId !== activePointerId) return
            try {
                if ('releasePointerCapture' in el) el.releasePointerCapture(event.pointerId)
            } catch {
                // noop
            }
            activePointerId = null
            window.removeEventListener('pointerup', handlePointerUp as EventListener)
            window.removeEventListener('pointercancel', handlePointerCancel as EventListener)
            document.removeEventListener('pointerup', handlePointerUp as EventListener)
            document.removeEventListener('pointercancel', handlePointerCancel as EventListener)
        }
        callbacks?.onTap?.()
        pwLog('[tap] pointerup', {
            w: el.getBoundingClientRect().width,
            h: el.getBoundingClientRect().height,
            transform: getComputedStyle(el).transform
        })
        if (!whileTap) return
        // Ensure the whileTap animation can't finish and overwrite our reset
        try {
            tapCtl?.cancel()
        } catch {
            // ignore
        }
        tapCtl = null
        const style = (el as HTMLElement).style
        if (baselineTransform && baselineTransform !== 'none') style.transform = baselineTransform
        else style.removeProperty('transform')
        pwLog('[tap] transform-restored', {
            baseline: baselineTransform,
            now: getComputedStyle(el).transform
        })
        const resetRecord = buildTapResetRecord(initial ?? {}, animateDef ?? {}, whileTap ?? {})
        pwLog('[tap] reset-record', resetRecord)
        if (Object.keys(resetRecord).length > 0) {
            resetCtl = animate(
                el,
                resetRecord as unknown as DOMKeyframesDefinition
            ) as unknown as Animation
            Promise.resolve((resetCtl as unknown as { finished?: Promise<void> }).finished)
                .then(() =>
                    pwLog('[tap] reset-finished', {
                        w: el.getBoundingClientRect().width,
                        h: el.getBoundingClientRect().height,
                        transform: getComputedStyle(el).transform
                    })
                )
                .catch(() => {})
                .finally(() => {
                    resetCtl = null
                })
        }
        // After baseline and reset committed, optionally reapply hover on next frame
        queueMicrotask(() => {
            reapplyHoverIfActive()
        })
    }
    const handlePointerCancel = (event: PointerEvent) => {
        if (typeof event.pointerId === 'number' && activePointerId !== null) {
            if (event.pointerId !== activePointerId) return
            try {
                if ('releasePointerCapture' in el) el.releasePointerCapture(event.pointerId)
            } catch {
                // noop
            }
            activePointerId = null
            window.removeEventListener('pointerup', handlePointerUp as EventListener)
            window.removeEventListener('pointercancel', handlePointerCancel as EventListener)
            document.removeEventListener('pointerup', handlePointerUp as EventListener)
            document.removeEventListener('pointercancel', handlePointerCancel as EventListener)
        }
        callbacks?.onTapCancel?.()
        pwLog('[tap] cancel', {
            w: el.getBoundingClientRect().width,
            h: el.getBoundingClientRect().height
        })
        // On cancel, also restore baseline if available
        if (initial || animateDef) {
            try {
                tapCtl?.cancel()
            } catch {
                // ignore
            }
            tapCtl = null
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
        pwLog('[tap] keydown', {
            key: e.key,
            w: el.getBoundingClientRect().width,
            h: el.getBoundingClientRect().height
        })
        try {
            tapCtl?.cancel()
        } catch {
            // ignore
        }
        tapCtl = animate(el, whileTap as unknown as DOMKeyframesDefinition) as unknown as Animation
    }

    const handleKeyUp = (e: KeyboardEvent) => {
        if (!(e.key === 'Enter' || e.key === ' ' || e.key === 'Space')) return
        // Prevent page scroll/activation for Space
        if (e.key === ' ' || e.key === 'Space') e.preventDefault?.()
        if (!keyboardActive) return
        keyboardActive = false
        callbacks?.onTap?.()
        pwLog('[tap] keyup', {
            key: e.key,
            w: el.getBoundingClientRect().width,
            h: el.getBoundingClientRect().height
        })
        if (reapplyHoverIfActive()) return
        if (initial || animateDef) {
            try {
                tapCtl?.cancel()
            } catch {
                // ignore
            }
            tapCtl = null
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
        pwLog('[tap] blur', {
            w: el.getBoundingClientRect().width,
            h: el.getBoundingClientRect().height
        })
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
        window.removeEventListener('pointerup', handlePointerUp as EventListener)
        window.removeEventListener('pointercancel', handlePointerCancel as EventListener)
        document.removeEventListener('pointerup', handlePointerUp as EventListener)
        document.removeEventListener('pointercancel', handlePointerCancel as EventListener)
        el.removeEventListener('keydown', handleKeyDown)
        el.removeEventListener('keyup', handleKeyUp)
        el.removeEventListener('blur', handleBlur)
    }
}
