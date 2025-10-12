import type { DragAxis, DragConstraints, DragControls, DragInfo, MotionWhileDrag } from '$lib/types'
import { pwLog, pwWarn } from '$lib/utils/log'
/**
 * Drag utilities
 *
 * This module implements low-level drag gesture handling that powers `motion.*` components.
 * It intentionally avoids Svelte-specific APIs so it can be reused in action-like contexts.
 *
 * Troubleshooting tips when drag "doesn't move":
 * - Ensure we are writing transforms via `animate(el, { x, y }, { duration: 0 })`.
 *   If computed style shows `transform: none`, another CSS rule may be overwriting the transform.
 * - Confirm `axis` allows the intended direction (true | 'x' | 'y').
 * - If using constraints as HTMLElement, verify both element and constraint refs are non-null and connected.
 * - If movement stops immediately, direction lock may be engaged. Try disabling `directionLock`.
 * - If post-release momentum never kicks in, velocity history may be empty (e.g., only pointerdown/up).
 *   Simulate a few `pointermove`s before releasing.
 * - For nested drags, set `propagation` as needed to avoid parent-child contention.
 */
import { applyConstraints as applyFloatConstraints } from '$lib/utils/dragMath'
import { deriveBoundaryPhysics } from '$lib/utils/dragParams'
import { computeHoverBaseline, splitHoverDefinition } from '$lib/utils/hover'
import { createInertiaToBoundary } from '$lib/utils/inertia'
import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'

type Rect = {
    top: number
    left: number
    right: number
    bottom: number
    width: number
    height: number
}

/**
 * Options passed to `attachDrag`. These are derived from `MotionProps` and pre-merged
 * with motion config in `_MotionContainer.svelte`.
 *
 * Note: `mergedTransition` should be the already-resolved transition that combines
 * MotionConfig context and the component's `transition` prop.
 */
export type AttachDragOptions = {
    axis: DragAxis
    constraints?: DragConstraints
    elastic?: number
    momentum?: boolean
    transition?: {
        bounceStiffness?: number
        bounceDamping?: number
        power?: number
        timeConstant?: number
        min?: number
        max?: number
    }
    directionLock?: boolean
    listener?: boolean
    controls?: DragControls | undefined
    whileDrag?: MotionWhileDrag
    mergedTransition: AnimationOptions
    callbacks?: {
        onStart?: (e: PointerEvent, info: DragInfo) => void
        onMove?: (e: PointerEvent, info: DragInfo) => void
        onEnd?: (e: PointerEvent, info: DragInfo) => void
        onDirectionLock?: (axis: 'x' | 'y') => void
        onTransitionEnd?: () => void
    }
    baselineSources?: { initial?: Record<string, unknown>; animate?: Record<string, unknown> }
    propagation?: boolean
    snapToOrigin?: boolean
}

/**
 * Read an element's DOMRect with null-safety.
 */
const getRect = (el: HTMLElement | null): Rect | null => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
        top: r.top,
        left: r.left,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height
    }
}

// const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max)

/**
 * Resolve drag constraints into pixel offsets relative to the dragged element's origin.
 *
 * - HTMLElement: Constrains the element to the bounding box of the provided element.
 * - Pixel object: Direct pixel limits for top/left/right/bottom.
 */
/**
 * Normalize constraints to pixel offsets relative to the dragged element's origin.
 *
 * HTMLElement constraints: allow moving within the container bounds (subtractive rect math).
 * Pixel object: direct min/max per side.
 */
export const resolveConstraints = (
    el: HTMLElement | null,
    constraints: DragConstraints | undefined
): { top: number; left: number; right: number; bottom: number } | null => {
    if (!constraints) return null
    if (constraints instanceof HTMLElement) {
        if (!el) return null
        const c = getRect(constraints)
        const e = getRect(el)
        if (!c || !e) return null
        // Allow element to move within container bounds
        return {
            top: c.top - e.top,
            left: c.left - e.left,
            right: c.right - e.right,
            bottom: c.bottom - e.bottom
        }
    }
    const { top = -Infinity, left = -Infinity, right = Infinity, bottom = Infinity } = constraints
    return { top, left, right, bottom }
}

/**
 * Apply elastic overflow outside of [min, max] using a linear ratio.
 */
/**
 * Apply elastic overflow outside the [min, max] range.
 * When beyond bounds, the extra distance is scaled linearly by `elastic`.
 */
export const applyElastic = (value: number, min: number, max: number, elastic: number): number => {
    if (value < min) return min + (value - min) * Math.max(0, Math.min(1, elastic))
    if (value > max) return max + (value - max) * Math.max(0, Math.min(1, elastic))
    return value
}

/** Prefer high-resolution time in browser; fall back for SSR/tests. */
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/**
 * Attach a drag gesture to an element.
 *
 * Captures the pointer, updates x/y transforms with axis and optional direction lock,
 * applies elastic overflow against constraints, emits lifecycle callbacks with DragInfo,
 * and runs a momentum animation on release when enabled.
 */
/**
 * Attach a drag gesture to an HTMLElement.
 *
 * Lifecycle:
 * - pointerdown → capture pointer, snapshot origin, start velocity history, enter whileDrag
 * - pointermove → compute deltas, direction lock, apply constraints + elastic, write x/y
 * - pointerup/cancel → either run momentum decay to a target or settle/clamp instantly
 *
 * Important invariants:
 * - `applied` tracks the currently applied transform (x/y). Always keep it in sync when
 *   writing transforms or finishing animations so a second drag starts from the right origin.
 * - If you see a "jump" at the start of a second drag, it usually means `applied` wasn't
 *   updated after a non-0-duration settle animation.
 */
export const attachDrag = (el: HTMLElement, opts: AttachDragOptions): (() => void) => {
    const EL_ID = el.getAttribute('data-testid') || el.id || el.tagName
    pwLog('[drag] attach', {
        el: EL_ID,
        axis: opts.axis,
        hasConstraints: !!opts.constraints,
        momentum: opts.momentum,
        elastic: opts.elastic,
        directionLock: opts.directionLock,
        listener: opts.listener,
        hasControls: !!opts.controls,
        snapToOrigin: opts.snapToOrigin,
        propagation: opts.propagation
    })
    const axis = opts.axis
    const directionLock = !!opts.directionLock
    const listenerEnabled = opts.listener !== false
    const elastic = typeof opts.elastic === 'number' ? opts.elastic : 0.35
    const momentum = opts.momentum !== false
    const mergedTransition = (opts.mergedTransition ?? {}) as AnimationOptions

    let constraints = resolveConstraints(el, opts.constraints)

    // Track state
    let dragging = false
    let lockAxis: 'x' | 'y' | null = null
    const lockThreshold = 4 // px to decide first-axis

    let startPoint = { x: 0, y: 0 }
    let lastPoint = { x: 0, y: 0 }
    // Accumulated transform applied to element via Motion ('x'/'y')
    const applied = { x: 0, y: 0 }
    // Origin transform at the start of current drag
    let origin = { x: 0, y: 0 }
    let velocity = { x: 0, y: 0 }
    // History for velocity smoothing (last N samples)
    let history: Array<{ x: number; y: number; t: number }> = []

    let whileDragBaseline: Record<string, unknown> | null = null
    let stopInertia: (() => void) | null = null

    const computeInfo = (): DragInfo => ({
        point: { ...lastPoint },
        delta: { x: lastPoint.x - startPoint.x, y: lastPoint.y - startPoint.y },
        offset: {
            x: origin.x + (lastPoint.x - startPoint.x),
            y: origin.y + (lastPoint.y - startPoint.y)
        },
        velocity: { ...velocity }
    })

    /**
     * Write absolute element-space translation using Motion's animate() with duration 0.
     * Also update `applied` so subsequent drags have the correct origin.
     */
    const setXY = (x: number, y: number) => {
        pwLog('[drag] setXY → animate(0)', { el: EL_ID, x, y })
        const payload: Record<string, unknown> = {}
        if (axis === true || axis === 'x') payload.x = x
        if (axis === true || axis === 'y') payload.y = y
        // Skip no-op writes within a tiny epsilon to reduce layout churn
        const EPS = 0.01
        const wantX = 'x' in payload
        const wantY = 'y' in payload
        const skipX = wantX && Math.abs(applied.x - x) < EPS
        const skipY = wantY && Math.abs(applied.y - y) < EPS
        if ((wantX ? skipX : true) && (wantY ? skipY : true)) {
            return
        }
        // duration: 0 to write instantly via Motion
        animate(el, payload as DOMKeyframesDefinition, { duration: 0 })
        // Track applied transform for correct subsequent drag origins
        if ('x' in payload) applied.x = x
        if ('y' in payload) applied.y = y

        // Verify it's actually applied; if not, retry once (Playwright visibility only)
        const cs = getComputedStyle(el)
        let actualTransform = cs.transform
        if (actualTransform === 'none' || !actualTransform.includes('matrix')) {
            pwWarn('⚠️ setXY transform missing; retrying write', {
                x,
                y,
                transform: actualTransform
            })
            animate(
                el,
                ('x' in payload || 'y' in payload ? payload : { x, y }) as DOMKeyframesDefinition,
                {
                    duration: 0
                }
            )
            actualTransform = getComputedStyle(el).transform
            if (actualTransform === 'none' || !actualTransform.includes('matrix')) {
                pwWarn('⚠️ setXY second attempt still missing transform', {
                    x,
                    y,
                    transform: actualTransform
                })
            }
        }
    }

    const startWhileDrag = () => {
        if (!opts.whileDrag) return
        // Baseline restore target: compute from sources
        whileDragBaseline = computeHoverBaseline(el, {
            initial: opts.baselineSources?.initial,
            animate: opts.baselineSources?.animate,
            whileHover: (opts.whileDrag ?? {}) as Record<string, unknown>
        })
        const { keyframes, transition } = splitHoverDefinition(
            opts.whileDrag as Record<string, unknown>
        )
        animate(
            el,
            keyframes as DOMKeyframesDefinition,
            (transition ?? mergedTransition) as AnimationOptions
        )
    }

    const endWhileDrag = () => {
        if (!whileDragBaseline || Object.keys(whileDragBaseline).length === 0) return
        animate(el, whileDragBaseline as unknown as DOMKeyframesDefinition, mergedTransition)
        whileDragBaseline = null
    }

    const onPointerDown = (e: PointerEvent) => {
        if (!listenerEnabled) return
        beginDrag(e)
    }

    /**
     * Begin a drag sequence. Optionally rebase the origin under the cursor (`snapToCursor`).
     * We capture the pointer to receive move/up/cancel regardless of hover state.
     */
    const beginDrag = (e: PointerEvent, snapToCursor = false) => {
        pwLog('[drag] begin', {
            el: EL_ID,
            pointer: { id: e.pointerId, x: e.clientX, y: e.clientY },
            snapToCursor
        })
        try {
            if ('setPointerCapture' in el && typeof e.pointerId === 'number')
                el.setPointerCapture(e.pointerId)
        } catch {
            // ignore
        }

        // Cancel any ongoing inertia
        if (stopInertia) {
            stopInertia()
            stopInertia = null
        }

        // Recompute constraints in case bounding boxes changed since last drag
        constraints = resolveConstraints(el, opts.constraints)
        pwLog('[drag] constraints (px)', { el: EL_ID, constraints })

        dragging = true
        lockAxis = null
        // Start from current applied transform, not viewport rect
        origin = { x: applied.x, y: applied.y }
        startPoint = { x: e.clientX, y: e.clientY }
        lastPoint = { ...startPoint }
        velocity = { x: 0, y: 0 }
        history = [{ x: e.clientX, y: e.clientY, t: now() }]

        if (snapToCursor) {
            const rect = el.getBoundingClientRect()
            // Rebase to center under cursor while preserving accumulated transform frame
            const desiredX = e.clientX - rect.width / 2
            const desiredY = e.clientY - rect.height / 2
            origin = { x: desiredX, y: desiredY }
            pwLog('[drag] snapToCursor origin', { el: EL_ID, origin })
        }

        startWhileDrag()
        opts.callbacks?.onStart?.(e, computeInfo())

        // Listen on element (to receive captured events) and window as fallback
        el.addEventListener('pointermove', onPointerMove as EventListener)
        el.addEventListener('pointerup', onPointerUp as EventListener)
        el.addEventListener('pointercancel', onPointerCancel as EventListener)
        window.addEventListener('pointermove', onPointerMove as EventListener)
        window.addEventListener('pointerup', onPointerUp as EventListener)
        window.addEventListener('pointercancel', onPointerCancel as EventListener)
    }

    /**
     * Update drag on pointer move:
     * - Track a small history for velocity smoothing
     * - Compute dx/dy from initial pointerdown
     * - Apply direction lock and constraints with elastic
     * - Write absolute x/y
     */
    const onPointerMove = (e: PointerEvent) => {
        if (!dragging) return
        const t = now()
        const nx = e.clientX
        const ny = e.clientY

        // Add to history and keep last 5 samples
        history.push({ x: nx, y: ny, t })
        if (history.length > 5) history.shift()

        // Calculate velocity from oldest to newest sample for smoothing
        if (history.length >= 2) {
            const oldest = history[0]
            const newest = history[history.length - 1]
            const dt = Math.max(1, newest.t - oldest.t)
            const vx = ((newest.x - oldest.x) / dt) * 1000 // px/s
            const vy = ((newest.y - oldest.y) / dt) * 1000
            velocity = { x: vx, y: vy }
        }

        lastPoint = { x: nx, y: ny }

        const dx = nx - startPoint.x
        const dy = ny - startPoint.y
        pwLog('[drag] move', {
            el: EL_ID,
            pointer: { x: nx, y: ny },
            deltas: { dx, dy },
            origin,
            applied,
            vel: velocity
        })

        // Direction lock
        if (directionLock && !lockAxis && Math.hypot(dx, dy) >= lockThreshold) {
            lockAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
            pwLog('[drag] directionLock', { el: EL_ID, lockAxis })
            opts.callbacks?.onDirectionLock?.(lockAxis)
        }

        const applyX = axis === true || axis === 'x'
        const applyY = axis === true || axis === 'y'

        let x = origin.x + (applyX ? dx : 0)
        let y = origin.y + (applyY ? dy : 0)
        const preClamp = { x, y }

        // Respect direction lock
        if (lockAxis === 'x') y = origin.y
        if (lockAxis === 'y') x = origin.x

        // Convert to relative translation by clamping within constraints (float-safe)
        if (constraints) {
            const minX = origin.x + (constraints.left ?? -Infinity)
            const maxX = origin.x + (constraints.right ?? Infinity)
            const minY = origin.y + (constraints.top ?? -Infinity)
            const maxY = origin.y + (constraints.bottom ?? Infinity)
            x = applyFloatConstraints(x, { min: minX, max: maxX }, elastic)
            y = applyFloatConstraints(y, { min: minY, max: maxY }, elastic)
            pwLog('[drag] constrain+elastic', {
                el: EL_ID,
                preClamp,
                bounds: { minX, maxX, minY, maxY },
                out: { x, y }
            })
        }

        // Apply absolute transform in element space
        setXY(x, y)
        opts.callbacks?.onMove?.(e, computeInfo())
    }

    const onPointerUp = (e: PointerEvent) => {
        pwLog('[drag] pointerup', {
            el: EL_ID,
            pointer: { id: e.pointerId, x: e.clientX, y: e.clientY },
            dragging
        })
        if (!dragging) return
        finishDrag(e)
    }
    const onPointerCancel = (e: PointerEvent) => {
        pwLog('[drag] pointercancel', {
            el: EL_ID,
            pointer: { id: e.pointerId, x: e.clientX, y: e.clientY },
            dragging
        })
        if (!dragging) return
        finishDrag(e)
    }

    /**
     * Finish a drag:
     * - If momentum is enabled, decay towards a clamped target with exponential easing
     * - Otherwise, animate back to a clamped position (or origin), then sync `applied`
     */
    const finishDrag = (e: PointerEvent) => {
        dragging = false
        pwLog('[drag] finish', {
            el: EL_ID,
            lastPoint,
            startPoint,
            origin,
            applied,
            momentum
        })
        try {
            if ('releasePointerCapture' in el && typeof e.pointerId === 'number')
                el.releasePointerCapture(e.pointerId)
        } catch {
            // ignore
        }

        el.removeEventListener('pointermove', onPointerMove as EventListener)
        el.removeEventListener('pointerup', onPointerUp as EventListener)
        el.removeEventListener('pointercancel', onPointerCancel as EventListener)
        window.removeEventListener('pointermove', onPointerMove as EventListener)
        window.removeEventListener('pointerup', onPointerUp as EventListener)
        window.removeEventListener('pointercancel', onPointerCancel as EventListener)

        // Momentum/inertia with boundary handoff: inertia until crossing, then spring to boundary
        if (momentum) {
            pwLog('🚀 STARTING MOMENTUM', {
                velocityX: velocity.x,
                velocityY: velocity.y,
                appliedX: applied.x,
                appliedY: applied.y,
                historyLength: history.length,
                historyFirst: history[0],
                historyLast: history[history.length - 1]
            })
            // If snapToOrigin, skip inertia and spring: use settle path to 0 for consistency
            if (opts.snapToOrigin) {
                pwLog('↩️ snapToOrigin: settle to (0,0)')
                const applyX = axis === true || axis === 'x'
                const applyY = axis === true || axis === 'y'
                const controls = animate(
                    el,
                    {
                        ...(applyX ? { x: 0 } : {}),
                        ...(applyY ? { y: 0 } : {})
                    } as DOMKeyframesDefinition,
                    (mergedTransition ?? {}) as AnimationOptions
                )
                Promise.resolve((controls as unknown as { finished?: Promise<void> }).finished)
                    .catch(() => {})
                    .finally(() => opts.callbacks?.onTransitionEnd?.())
                return
            }

            const minX = origin.x + (constraints?.left ?? -Infinity)
            const maxX = origin.x + (constraints?.right ?? Infinity)
            const minY = origin.y + (constraints?.top ?? -Infinity)
            const maxY = origin.y + (constraints?.bottom ?? Infinity)

            const { timeConstantMs, restDelta, restSpeed, bounceStiffness, bounceDamping } =
                deriveBoundaryPhysics(elastic, opts.transition)

            pwLog('⚙️ boundary-physics', {
                timeConstantMs,
                restDelta,
                restSpeed,
                bounceStiffness,
                bounceDamping,
                bounds: { minX, maxX, minY, maxY },
                lockAxis,
                axis
            })

            // Respect direction lock on release: only animate the locked axis
            const applyX = (axis === true || axis === 'x') && lockAxis !== 'y'
            const applyY = (axis === true || axis === 'y') && lockAxis !== 'x'

            const stepX = applyX
                ? createInertiaToBoundary(
                      { value: applied.x, velocity: velocity.x },
                      { min: minX, max: maxX },
                      { timeConstantMs, restDelta, restSpeed, bounceStiffness, bounceDamping }
                  )
                : null
            const stepY = applyY
                ? createInertiaToBoundary(
                      { value: applied.y, velocity: velocity.y },
                      { min: minY, max: maxY },
                      { timeConstantMs, restDelta, restSpeed, bounceStiffness, bounceDamping }
                  )
                : null

            let running = true
            const startTs = now()
            let frameCount = 0

            const raf = () => {
                if (!running) {
                    pwLog('🛑 RAF stopped (running = false)')
                    return
                }
                const t = now() - startTs
                frameCount++

                const rx = stepX ? stepX(t) : { value: applied.x, done: true }
                const ry = stepY ? stepY(t) : { value: applied.y, done: true }

                setXY(rx.value, ry.value)

                if (frameCount <= 3 || frameCount % 10 === 0) {
                    pwLog(`🔄 FRAME ${frameCount}`, {
                        t: t.toFixed(0),
                        px: rx.value.toFixed?.(2) ?? rx.value,
                        py: ry.value.toFixed?.(2) ?? ry.value,
                        doneX: rx.done,
                        doneY: ry.done
                    })
                }

                if ((rx.done || !stepX) && (ry.done || !stepY)) {
                    pwLog('✅ REST REACHED', {
                        frameCount,
                        finalX: rx.value,
                        finalY: ry.value,
                        timeConstantMs,
                        restDelta,
                        restSpeed
                    })
                    running = false
                    stopInertia = null
                    opts.callbacks?.onTransitionEnd?.()
                    return
                }
                requestAnimationFrame(raf)
            }

            stopInertia = () => {
                pwLog('❌ MOMENTUM CANCELLED')
                running = false
                stopInertia = null
            }

            pwLog('🏁 QUEUING RAF')
            requestAnimationFrame(raf)
        } else {
            // No momentum: animate to clamped target or origin to resolve elastic overdrag
            const applyX = axis === true || axis === 'x'
            const applyY = axis === true || axis === 'y'
            const dx = lastPoint.x - startPoint.x
            const dy = lastPoint.y - startPoint.y
            let x = origin.x + (applyX ? dx : 0)
            let y = origin.y + (applyY ? dy : 0)

            // Respect direction lock
            if (lockAxis === 'x') y = origin.y
            if (lockAxis === 'y') x = origin.x

            if (opts.snapToOrigin) {
                x = 0
                y = 0
            } else if (constraints) {
                const minX = origin.x + (constraints.left ?? -Infinity)
                const maxX = origin.x + (constraints.right ?? Infinity)
                const minY = origin.y + (constraints.top ?? -Infinity)
                const maxY = origin.y + (constraints.bottom ?? Infinity)
                x = applyFloatConstraints(x, { min: minX, max: maxX })
                y = applyFloatConstraints(y, { min: minY, max: maxY })
            }
            pwLog('[drag] settle (no momentum)', {
                el: EL_ID,
                target: { x, y },
                origin,
                applied,
                dx,
                dy
            })

            // Animate with the merged transition so the settle feels consistent with other motion
            const controls = animate(
                el,
                { ...(applyX ? { x } : {}), ...(applyY ? { y } : {}) } as DOMKeyframesDefinition,
                (mergedTransition ?? {}) as AnimationOptions
            )
            // Fire transition end once settled
            Promise.resolve((controls as unknown as { finished?: Promise<void> }).finished)
                .then(() => {
                    // Sync internal applied transform so next drag uses the correct origin
                    if (applyX) applied.x = x
                    if (applyY) applied.y = y
                    pwLog('[drag] settle finished → sync applied', {
                        el: EL_ID,
                        applied
                    })
                })
                .catch(() => {})
                .finally(() => opts.callbacks?.onTransitionEnd?.())
        }

        opts.callbacks?.onEnd?.(e, computeInfo())
        endWhileDrag()
    }

    // Wire dragControls
    if (opts.controls) {
        const internal = opts.controls as unknown as {
            _bind?: (el: HTMLElement, starter: (e: PointerEvent, snap?: boolean) => void) => void
        }
        internal._bind?.(el, beginDrag)
        pwLog('[drag] controls bound', { el: EL_ID })
    }

    el.addEventListener('pointerdown', onPointerDown)
    pwLog('[drag] pointerdown listener attached', { el: EL_ID })

    return () => {
        pwLog('[drag] detach', { el: EL_ID })
        el.removeEventListener('pointerdown', onPointerDown)
        el.removeEventListener('pointermove', onPointerMove as EventListener)
        el.removeEventListener('pointerup', onPointerUp as EventListener)
        el.removeEventListener('pointercancel', onPointerCancel as EventListener)
        window.removeEventListener('pointermove', onPointerMove as EventListener)
        window.removeEventListener('pointerup', onPointerUp as EventListener)
        window.removeEventListener('pointercancel', onPointerCancel as EventListener)
    }
}
