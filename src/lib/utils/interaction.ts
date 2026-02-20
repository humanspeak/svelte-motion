import { isHoverCapable, splitHoverDefinition } from '$lib/utils/hover'
import { pwLog } from '$lib/utils/log'
import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'
import { press } from 'motion-dom'

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
 * Uses motion-dom's `press()` for pointer and Enter-key handling (with
 * primary-pointer filtering, drag interop, and global release listeners).
 * Space-key support is added manually since `press()` only handles Enter.
 *
 * @param el Element to attach listeners to.
 * @param whileTap While-tap keyframe record.
 * @param initial Initial keyframe record.
 * @param animateDef Animate keyframe record.
 * @param callbacks Optional lifecycle callbacks.
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

    pwLog('[tap] attached', { whileTap, initial, animateDef, hasHoverDef: !!callbacks?.hoverDef })

    // Tween transitions prevent spring velocity accumulation during rapid
    // press/release cycles. Cubic-bezier with slight overshoot mimics the
    // reference spring feel (~275ms settle, ~7% overshoot).
    const pressTransition: AnimationOptions = { duration: 0.25, ease: [0.22, 1.1, 0.36, 1] }
    const releaseTransition: AnimationOptions = { duration: 0.3, ease: [0.22, 1.1, 0.36, 1] }

    // Motion's animate() returns AnimationPlaybackControls (not native Animation).
    type GestureCtl = {
        stop: () => void
        cancel: () => void
        currentTime: number | null
        finished?: Promise<void>
    }

    // Single control tracking whatever gesture animation is in-flight
    // (tap, reset, or hover reapply). Every new gesture cancels the previous.
    let gestureCtl: GestureCtl | null = null

    const cancelGesture = () => {
        if (gestureCtl) {
            pwLog('[tap] cancel-gesture', {
                currentTime: gestureCtl.currentTime,
                transform: getComputedStyle(el).transform
            })
        }
        try {
            // Use stop() instead of cancel(). cancel() reverts to the
            // pre-animation state (causing a visual snap), while stop()
            // holds the element at its current interpolated position.
            gestureCtl?.stop()
        } catch {
            // ignore
        }
        gestureCtl = null
    }

    const animateTap = () => {
        pwLog('[tap] animate-tap', {
            w: el.getBoundingClientRect().width,
            h: el.getBoundingClientRect().height,
            transform: getComputedStyle(el).transform,
            whileTap,
            gestureActive: gestureCtl !== null
        })
        cancelGesture()
        callbacks?.onTapStart?.()
        gestureCtl = animate(
            el,
            whileTap as unknown as DOMKeyframesDefinition,
            pressTransition
        ) as unknown as GestureCtl
        Promise.resolve(gestureCtl?.finished)
            .then(() =>
                pwLog('[tap] tap-applied', {
                    w: el.getBoundingClientRect().width,
                    h: el.getBoundingClientRect().height,
                    transform: getComputedStyle(el).transform
                })
            )
            .catch(() => {})
    }

    const reapplyHoverIfActive = (): boolean => {
        if (!callbacks?.hoverDef) {
            pwLog('[tap] hover-reapply-skip', { reason: 'no hoverDef' })
            return false
        }
        if (!isHoverCapable()) {
            pwLog('[tap] hover-reapply-skip', { reason: 'not hover-capable' })
            return false
        }
        try {
            if (!el.matches(':hover')) {
                pwLog('[tap] hover-reapply-skip', { reason: 'not :hover' })
                return false
            }
        } catch {
            pwLog('[tap] hover-reapply-skip', { reason: 'matches threw' })
            return false
        }
        const { keyframes } = splitHoverDefinition(callbacks.hoverDef as Record<string, unknown>)
        pwLog('[tap] hover-reapply', {
            keyframes,
            transform: getComputedStyle(el).transform,
            w: el.getBoundingClientRect().width
        })
        gestureCtl = animate(
            el,
            keyframes as unknown as DOMKeyframesDefinition,
            releaseTransition
        ) as unknown as GestureCtl
        Promise.resolve(gestureCtl?.finished)
            .then(() =>
                pwLog('[tap] hover-reapply-done', {
                    w: el.getBoundingClientRect().width,
                    transform: getComputedStyle(el).transform
                })
            )
            .catch(() => {})
        return true
    }

    const animateReset = (success: boolean) => {
        pwLog('[tap] animate-reset', {
            success,
            w: el.getBoundingClientRect().width,
            h: el.getBoundingClientRect().height,
            transform: getComputedStyle(el).transform,
            gestureActive: gestureCtl !== null
        })
        if (success) callbacks?.onTap?.()
        else callbacks?.onTapCancel?.()

        cancelGesture()

        // If still hovering after a successful tap, animate to hover state
        if (success && reapplyHoverIfActive()) return

        const resetRecord = buildTapResetRecord(initial ?? {}, animateDef ?? {}, whileTap ?? {})
        pwLog('[tap] reset-record', resetRecord)
        if (Object.keys(resetRecord).length > 0) {
            gestureCtl = animate(
                el,
                resetRecord as unknown as DOMKeyframesDefinition,
                releaseTransition
            ) as unknown as GestureCtl
            Promise.resolve(gestureCtl?.finished)
                .then(() =>
                    pwLog('[tap] reset-done', {
                        w: el.getBoundingClientRect().width,
                        h: el.getBoundingClientRect().height,
                        transform: getComputedStyle(el).transform
                    })
                )
                .catch(() => {})
        }
    }

    // Use press() for pointer + Enter key handling
    const cancelPress = press(el, () => {
        pwLog('[tap] press-start', {
            w: el.getBoundingClientRect().width,
            transform: getComputedStyle(el).transform
        })
        animateTap()
        return (_endEvent: PointerEvent, { success }: { success: boolean }) => {
            pwLog('[tap] press-end', {
                success,
                w: el.getBoundingClientRect().width,
                transform: getComputedStyle(el).transform
            })
            animateReset(success)
        }
    })

    // Add Space key support (press() only handles Enter)
    let spaceActive = false

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== ' ' && e.key !== 'Space') return
        e.preventDefault()
        if (spaceActive) return
        spaceActive = true
        pwLog('[tap] space-down', {
            w: el.getBoundingClientRect().width,
            transform: getComputedStyle(el).transform
        })
        animateTap()
    }

    const onKeyUp = (e: KeyboardEvent) => {
        if (e.key !== ' ' && e.key !== 'Space') return
        e.preventDefault()
        if (!spaceActive) return
        spaceActive = false
        pwLog('[tap] space-up', {
            w: el.getBoundingClientRect().width,
            transform: getComputedStyle(el).transform
        })
        animateReset(true)
    }

    const onBlur = () => {
        if (!spaceActive) return
        spaceActive = false
        pwLog('[tap] blur', {
            w: el.getBoundingClientRect().width,
            transform: getComputedStyle(el).transform
        })
        animateReset(false)
    }

    el.addEventListener('keydown', onKeyDown)
    el.addEventListener('keyup', onKeyUp)
    el.addEventListener('blur', onBlur)

    return () => {
        pwLog('[tap] cleanup')
        cancelPress()
        el.removeEventListener('keydown', onKeyDown)
        el.removeEventListener('keyup', onKeyUp)
        el.removeEventListener('blur', onBlur)
    }
}
