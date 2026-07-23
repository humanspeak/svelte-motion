import type { GestureCoordinator } from '$lib/utils/gestureCoordinator'
import {
    computeHoverBaseline,
    isHoverCapable,
    readTransformChannels,
    splitHoverDefinition
} from '$lib/utils/hover'
import { pwLog } from '$lib/utils/log'
import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'
import { getDefaultTransition, press, type MotionValue } from 'motion-dom'

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
            resetRecord[k] = undefined
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
        /** The component's resolved `transition` (or `<MotionConfig>` transition) —
         *  honored for the tap gesture (framer parity). When empty, the gesture
         *  passes no transition so motion-dom applies its per-value defaults. */
        tapTransition?: AnimationOptions | undefined
        /** Shared per-element gesture coordinator (see gestureCoordinator.ts):
         *  tracks tap/hover active state and lets hover and tap stop each
         *  other's in-flight animations so exactly one writer owns the element. */
        coordinator?: GestureCoordinator
        /** Creation-time authored base values (e.g. `opacity`), captured at
         *  rest — the same record the hover system threads into its baseline
         *  computation. Without it, the orphaned-key restore on tap release
         *  falls back to LIVE computed style, which on a slow frame reads a
         *  mid-animation transient and settles the element short of rest. */
        getBaseStyleValues?: () => Record<string, unknown>
        /** Read the persistent per-channel `MotionValue` the hover composed
         *  writer drives, shared via the same per-element map. When a tap
         *  interrupts a mid-flight hover, position already carries via the
         *  matrix seed (see `seedStaleChannels`) — but VELOCITY was discarded.
         *  Reading the shared value's live `getVelocity()` at press time lets the
         *  tap spring launch from the hover's momentum (upstream re-targets the
         *  same MotionValue), so flicking across a target or pressing mid-spring
         *  keeps its feel instead of snapping to a dead zero-velocity start. */
        getSharedChannelValue?: (key: string) => MotionValue<number> | undefined
    }
): (() => void) => {
    if (!whileTap) return () => {}

    pwLog('[tap] attached', { whileTap, initial, animateDef, hasHoverDef: !!callbacks?.hoverDef })

    // Split any inline `transition` out of the whileTap definition (mirrors
    // splitHoverDefinition) so it never leaks into the animated keyframes and
    // can be honored as the press transition.
    const { transition: inlineTapTransition, ...tapKeyframes } = whileTap as {
        transition?: AnimationOptions
    } & Record<string, unknown>

    // Resolve the gesture transition with framer-motion's precedence:
    //   1. inline `whileTap.transition` — configures entering the tap state (press only)
    //   2. the component's resolved `transition` / <MotionConfig> (via `tapTransition`)
    //   3. undefined → motion-dom applies its own per-value defaults:
    //        scale           → spring(stiffness 550, damping 30)  (mild ~7% overshoot)
    //        x / y / rotate… → spring(stiffness 500, damping 25)
    //        everything else → ease [0.25, 0.1, 0.35, 1] over 0.3s
    //      Passing no transition is exact framer parity (including the intended
    //      spring overshoot on transforms) and inherits future upstream tuning
    //      for free. See upstream:
    //        motion-dom/src/animation/utils/default-transitions.ts        (getDefaultTransition)
    //        motion-dom/src/animation/interfaces/motion-value.ts          (per-value application)
    //        motion-dom/src/animation/interfaces/visual-element-target.ts (component-transition precedence)
    //      The historical spring "runaway" (see git history around the old
    //      hardcoded tweens) does not recur: every animate() call reuses the
    //      same motion values, so velocity is continuous and rapid press/release
    //      interrupts cleanly instead of accumulating. Covered by a rapid-tap e2e.
    const componentTapTransition =
        callbacks?.tapTransition && Object.keys(callbacks.tapTransition).length > 0
            ? callbacks.tapTransition
            : undefined
    // Press honors an inline whileTap.transition (framer applies it only when
    // entering the tap state). Release animates back to the BASE variant, so
    // upstream resolves ITS inline transition (`animate={{ ..., transition }}`)
    // first, then the component transition, then the per-value defaults.
    const animateInlineTransition = (animateDef as { transition?: AnimationOptions } | undefined)
        ?.transition
    const pressTransition: AnimationOptions | undefined =
        inlineTapTransition ?? componentTapTransition
    const releaseTransition: AnimationOptions | undefined =
        animateInlineTransition ?? componentTapTransition

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
    const coordinator = callbacks?.coordinator

    const cancelGesture = () => {
        if (gestureCtl) {
            pwLog('[tap] cancel-gesture', () => ({
                currentTime: gestureCtl!.currentTime,
                transform: getComputedStyle(el).transform
            }))
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
        // Single-writer: also stop the hover system's in-flight animations
        // (e.g. a hover-exit unwind) before this gesture starts writing.
        coordinator?.stopAll()
    }

    // When the hover system's composed writer was the last to touch a transform
    // channel, motion's internal motion value for THAT channel is stale — seed
    // the keyframes from the element's VISUAL value so the animation starts
    // where the eye left off instead of snapping to the stale value on frame
    // one. The composed writer (hover.ts writeComposedChannels) flags every
    // channel it owns via coordinator.markExternalWrite(key); we consume each
    // flag here for EVERY seedable key — whether or not a reseed applies — so
    // the coordinator's Set never accumulates over the element's lifetime.
    // 3D channels (rotateX/rotateY/z) are intentionally left unseeded: the 2D
    // matrix reader can't decompose them (readTransformChannels returns null).
    const seedableChannels = ['scale', 'scaleX', 'scaleY', 'x', 'y', 'rotate'] as const
    const seedStaleChannels = (record: Record<string, unknown>): Record<string, unknown> => {
        if (!coordinator) return record
        let seeded = record
        // Read the visual matrix at most once, lazily — only when a channel was
        // actually flagged as externally written.
        let visual: ReturnType<typeof readTransformChannels> | undefined
        for (const key of seedableChannels) {
            // Consume unconditionally so the flag is cleared even when the
            // checks below skip the reseed (fixes the Set accumulation).
            if (!coordinator.consumeExternalWrite(key)) continue
            const target = seeded[key]
            if (typeof target !== 'number') continue
            if (visual === undefined) visual = readTransformChannels(el)
            // null → matrix3d we can't decompose; leave this channel unseeded.
            if (visual === null) continue
            // scaleX/scaleY approximate from the uniform matrix scale: a 2D
            // matrix can't separate per-axis scale, so both seed from the same
            // hypot(a,b) reading — enough to avoid a frame-one snap.
            const current = key === 'scaleX' || key === 'scaleY' ? visual.scale : visual[key]
            if (Math.abs(current - target) < 0.001) continue
            if (seeded === record) seeded = { ...record }
            seeded[key] = [current, target]
        }
        return seeded
    }

    // Read the live velocity of each seedable channel the tap animates from the
    // shared hover MotionValue. Position already carries via the matrix seed
    // above; this is the missing VELOCITY. Called BEFORE cancelGesture stops the
    // hover writer, so a mid-flight press samples the spring's true momentum
    // rather than a just-stopped (decaying) reading. Channels without a shared
    // value, or effectively at rest (|v| ~ 0 when hover isn't mid-flight), are
    // omitted so nothing spurious is injected.
    const collectHandoffVelocities = (record: Record<string, unknown>): Record<string, number> => {
        const velocities: Record<string, number> = {}
        const getShared = callbacks?.getSharedChannelValue
        if (!getShared) return velocities
        for (const key of seedableChannels) {
            if (typeof record[key] !== 'number') continue
            const shared = getShared(key)
            if (!shared) continue
            const velocity = shared.getVelocity()
            if (Number.isFinite(velocity) && Math.abs(velocity) > 0.0001) {
                velocities[key] = velocity
            }
        }
        return velocities
    }

    // Merge carried per-channel velocities into a gesture transition as
    // value-specific overrides. Upstream `getValueTransition(transition, key)`
    // resolves `transition[key] ?? transition.default ?? transition`, so every
    // non-velocity channel falls through to `default` (the base transition, or
    // `{}` so it keeps its own per-value defaults) while a velocity channel
    // inherits its transition PLUS the carried `velocity` so a spring launches
    // from the hover's momentum.
    //
    // Crucially, a bare `{ velocity }` is NOT enough: upstream
    // `isTransitionDefined` treats `velocity` as a defining key, which SUPPRESSES
    // the per-value default spring and collapses the animation to a tween that
    // ignores velocity entirely. So when the base has no explicit type we splice
    // in the channel's OWN default spring (same `getDefaultTransition` the hover
    // writer uses) and attach the velocity to it. When the base already defines a
    // transition it is honored as-is plus the velocity (a user tween still can't
    // overshoot, which is correct).
    const withHandoffVelocity = (
        base: AnimationOptions | undefined,
        velocities: Record<string, number>
    ): AnimationOptions | undefined => {
        const keys = Object.keys(velocities)
        if (keys.length === 0) return base
        const baseObject = (base ?? {}) as Record<string, unknown>
        const baseIsDefined = Object.keys(baseObject).length > 0
        const merged: Record<string, unknown> = { default: base ? { ...baseObject } : {} }
        for (const key of keys) {
            // Resolve the channel's transition the way motion-dom does
            // (getValueTransition: transition[key] ?? transition.default ??
            // transition) BEFORE attaching velocity. Spreading the whole base
            // object here buried a value-specific override ({ scale: {...} })
            // one level too deep, where motion-dom cannot see its type/damping
            // — the authored spring silently degraded (adversarial-review
            // finding).
            const channelBase = baseIsDefined
                ? ((baseObject[key] ?? baseObject.default ?? baseObject) as Record<
                      string,
                      unknown
                  >)
                : (getDefaultTransition(key, { keyframes: [0, 1] }) as Record<string, unknown>)
            merged[key] = { ...channelBase, velocity: velocities[key] }
        }
        return merged as AnimationOptions
    }

    // Track the in-flight control with the coordinator so the hover system
    // can stop it symmetrically (e.g. leaving mid-release-spring).
    const setGestureCtl = (ctl: GestureCtl) => {
        gestureCtl = ctl
        const unregister = coordinator?.register(() => {
            try {
                ctl.stop()
            } catch {
                // ignore
            }
            if (gestureCtl === ctl) gestureCtl = null
        })
        Promise.resolve(ctl.finished)
            .catch(() => {})
            .finally(() => unregister?.())
    }

    const animateTap = () => {
        pwLog('[tap] animate-tap', () => ({
            w: el.getBoundingClientRect().width,
            h: el.getBoundingClientRect().height,
            transform: getComputedStyle(el).transform,
            whileTap,
            gestureActive: gestureCtl !== null
        }))
        coordinator?.setActive('tap', true)
        // Sample the hover spring's live velocity BEFORE cancelGesture stops it,
        // so a mid-flight press carries true momentum into the tap retarget.
        const handoffVelocities = collectHandoffVelocities(tapKeyframes)
        cancelGesture()
        callbacks?.onTapStart?.()
        setGestureCtl(
            animate(
                el,
                seedStaleChannels(tapKeyframes) as unknown as DOMKeyframesDefinition,
                withHandoffVelocity(pressTransition, handoffVelocities)
            ) as unknown as GestureCtl
        )
        Promise.resolve(gestureCtl?.finished)
            .then(() =>
                pwLog('[tap] tap-applied', () => ({
                    w: el.getBoundingClientRect().width,
                    h: el.getBoundingClientRect().height,
                    transform: getComputedStyle(el).transform
                }))
            )
            .catch(() => {})
    }

    const isHoverStillActive = (): boolean => {
        // Prefer the coordinator's tracked state (upstream setActive
        // semantics): the DOM's `:hover` can report true after the hover
        // system has already dispatched its exit, and vice versa.
        if (coordinator) return coordinator.isActive('hover')
        try {
            return el.matches(':hover')
        } catch {
            return false
        }
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
        if (!isHoverStillActive()) {
            pwLog('[tap] hover-reapply-skip', { reason: 'hover not active' })
            return false
        }
        const { keyframes, transition: hoverTransition } = splitHoverDefinition(callbacks.hoverDef)
        pwLog('[tap] hover-reapply', () => ({
            keyframes,
            transform: getComputedStyle(el).transform,
            w: el.getBoundingClientRect().width
        }))
        // Reapplying hover after a tap animates to the hover state, so it should
        // use the hover definition's own transition when provided, falling back
        // to the release transition (component prop → per-value defaults).
        setGestureCtl(
            animate(
                el,
                seedStaleChannels(keyframes) as unknown as DOMKeyframesDefinition,
                hoverTransition ?? releaseTransition
            ) as unknown as GestureCtl
        )
        Promise.resolve(gestureCtl?.finished)
            .then(() =>
                pwLog('[tap] hover-reapply-done', () => ({
                    w: el.getBoundingClientRect().width,
                    transform: getComputedStyle(el).transform
                }))
            )
            .catch(() => {})
        return true
    }

    const animateReset = (success: boolean) => {
        pwLog('[tap] animate-reset', () => ({
            success,
            w: el.getBoundingClientRect().width,
            h: el.getBoundingClientRect().height,
            transform: getComputedStyle(el).transform,
            gestureActive: gestureCtl !== null
        }))
        coordinator?.setActive('tap', false)
        if (success) callbacks?.onTap?.()
        else callbacks?.onTapCancel?.()

        cancelGesture()

        // If still hovering after a successful tap, animate to hover state
        if (success && reapplyHoverIfActive()) return

        const resetRecord = buildTapResetRecord(initial ?? {}, animateDef ?? {}, tapKeyframes)

        // Per-key restore (upstream animation-state.ts removed-key handling):
        // hover may have applied a key while this tap was pressed that whileTap
        // never owned (e.g. `opacity` while tap owns `scale`). When hover is no
        // longer active, hover-end already tried to restore that key — but
        // THIS release's cancelGesture() swept the coordinator and stopped that
        // in-flight restore mid-flight, so the orphaned key would stay stuck.
        // Extend the reset with each orphaned hover key's baseline so it settles
        // to base in the same single writer as the tap keys. We reuse hover's
        // own baseline computation rather than duplicating it (in scope: no
        // _MotionContainer wiring — computeHoverBaseline is already exported and
        // imported here). Overlapping keys (in whileTap) are left to
        // buildTapResetRecord; still-hovering keeps hover's keys applied.
        if (!isHoverStillActive() && callbacks?.hoverDef) {
            const { keyframes: hoverKeyframes } = splitHoverDefinition(callbacks.hoverDef)
            const orphanedKeys = Object.keys(hoverKeyframes).filter(
                (k) => !Object.prototype.hasOwnProperty.call(tapKeyframes, k)
            )
            if (orphanedKeys.length > 0) {
                const hoverBaseline = computeHoverBaseline(el, {
                    initial,
                    animate: animateDef,
                    whileHover: hoverKeyframes,
                    baseStyleValues: callbacks?.getBaseStyleValues?.()
                })
                for (const k of orphanedKeys) {
                    if (Object.prototype.hasOwnProperty.call(hoverBaseline, k)) {
                        resetRecord[k] = hoverBaseline[k]
                    }
                }
            }
        }

        pwLog('[tap] reset-record', resetRecord)
        if (Object.keys(resetRecord).length > 0) {
            setGestureCtl(
                animate(
                    el,
                    seedStaleChannels(resetRecord) as unknown as DOMKeyframesDefinition,
                    releaseTransition
                ) as unknown as GestureCtl
            )
            Promise.resolve(gestureCtl?.finished)
                .then(() =>
                    pwLog('[tap] reset-done', () => ({
                        w: el.getBoundingClientRect().width,
                        h: el.getBoundingClientRect().height,
                        transform: getComputedStyle(el).transform
                    }))
                )
                .catch(() => {})
        }
    }

    // Use press() for pointer + Enter key handling
    const cancelPress = press(el, () => {
        pwLog('[tap] press-start', () => ({
            w: el.getBoundingClientRect().width,
            transform: getComputedStyle(el).transform
        }))
        animateTap()
        return (_endEvent: PointerEvent, { success }: { success: boolean }) => {
            pwLog('[tap] press-end', () => ({
                success,
                w: el.getBoundingClientRect().width,
                transform: getComputedStyle(el).transform
            }))
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
        pwLog('[tap] space-down', () => ({
            w: el.getBoundingClientRect().width,
            transform: getComputedStyle(el).transform
        }))
        animateTap()
    }

    const onKeyUp = (e: KeyboardEvent) => {
        if (e.key !== ' ' && e.key !== 'Space') return
        e.preventDefault()
        if (!spaceActive) return
        spaceActive = false
        pwLog('[tap] space-up', () => ({
            w: el.getBoundingClientRect().width,
            transform: getComputedStyle(el).transform
        }))
        animateReset(true)
    }

    const onBlur = () => {
        if (!spaceActive) return
        spaceActive = false
        pwLog('[tap] blur', () => ({
            w: el.getBoundingClientRect().width,
            transform: getComputedStyle(el).transform
        }))
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
