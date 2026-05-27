import type { DragAxis, DragConstraints, DragControls, DragInfo, MotionWhileDrag } from '$lib/types'
import { isPlaywrightEnv, pwLog, pwWarn } from '$lib/utils/log'
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
import { isDomElement } from '$lib/utils/dom'
import {
    applyConstraints as applyFloatConstraints,
    parseMatrixTranslate
} from '$lib/utils/dragMath'
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
    if (isDomElement(constraints)) {
        if (!el) return null
        const c = getRect(constraints as unknown as HTMLElement)
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

/** Sample windows for release-velocity inference (matches motion-dom values). */
const MAX_VELOCITY_DELTA_MS = 30
const MIN_VELOCITY_INTERVAL_MS = 5

/**
 * Compute the release velocity for momentum from a pointer-history window.
 *
 * Mirrors motion-dom: walks back from the newest sample, including only
 * samples within `MAX_VELOCITY_DELTA_MS` (30 ms) of newest, then divides
 * the displacement by the elapsed time. Returns 0 if the newest sample is
 * stale, the window has fewer than two samples, or the oldest-newest span
 * is shorter than `MIN_VELOCITY_INTERVAL_MS` (5 ms — sub-frame).
 *
 * @param history Recent pointer samples ordered oldest → newest. Each
 *   sample is `{ x, y, t }` where `t` is `performance.now()` ms.
 * @param nowMs Current `performance.now()` ms — used to discard a stale
 *   newest sample (finger lifted after a pause).
 * @returns Inferred release velocity in pixels per second on each axis.
 * @example
 *   const v = computeReleaseVelocity(
 *       [{ x: 0, y: 0, t: 1000 }, { x: 20, y: 0, t: 1020 }],
 *       1020
 *   )
 *   // v ≈ { x: 1000, y: 0 } — 20 px over 20 ms → 1000 px/s
 */
const computeReleaseVelocity = (
    history: ReadonlyArray<{ x: number; y: number; t: number }>,
    nowMs: number
): { x: number; y: number } => {
    if (history.length < 2) return { x: 0, y: 0 }
    const newest = history[history.length - 1]
    if (nowMs - newest.t > MAX_VELOCITY_DELTA_MS) return { x: 0, y: 0 }
    let oldestIdx = history.length - 1
    for (let i = history.length - 2; i >= 0; i--) {
        if (newest.t - history[i].t > MAX_VELOCITY_DELTA_MS) break
        oldestIdx = i
    }
    if (oldestIdx === history.length - 1) return { x: 0, y: 0 }
    const oldest = history[oldestIdx]
    const dtMs = newest.t - oldest.t
    if (dtMs < MIN_VELOCITY_INTERVAL_MS) return { x: 0, y: 0 }
    return {
        x: ((newest.x - oldest.x) / dtMs) * 1000,
        y: ((newest.y - oldest.y) / dtMs) * 1000
    }
}

/**
 * Cleanup handle returned by {@link attachDrag}. Invoke it to tear the
 * gesture down (removes listeners, cancels any in-flight momentum/settle
 * animation). It also carries `adjustOrigin(dx, dy)`, which shifts the
 * LIVE gesture's origin + visual offset by a layout-shift delta mid-drag
 * — used for projection-driven cursor pinning when a layout slot moves
 * under the dragged element (#379 / #310). `adjustOrigin` is a no-op when
 * not currently dragging and only affects axes the drag is unlocked on.
 */
export type AttachDragCleanup = (() => void) & {
    adjustOrigin: (dx: number, dy: number) => void
}

/**
 * Attach a drag gesture to an element.
 *
 * Captures the pointer and updates x/y transforms with axis and optional
 * direction lock, applies elastic overflow against constraints, emits
 * lifecycle callbacks with `DragInfo`, and runs a momentum animation on
 * release when enabled.
 *
 * Lifecycle:
 * - pointerdown → capture pointer, snapshot origin, start velocity history, enter whileDrag
 * - pointermove → compute deltas, direction lock, apply constraints + elastic, write x/y
 * - pointerup/cancel → either run momentum decay to a target or settle/clamp instantly
 *
 * Invariant: `applied` tracks the currently applied x/y transform — it
 * must stay in sync when writing transforms or finishing animations, or a
 * second drag "jumps" from a stale origin (commonly a missed update after
 * a non-zero-duration settle animation).
 *
 * @param el The element to make draggable.
 * @param opts Drag options — `axis`, `constraints`, `elastic`,
 *   `momentum`, `whileDrag`, and the `onDrag*` lifecycle callbacks.
 * @returns A callable cleanup handle ({@link AttachDragCleanup}): call it
 *   to detach listeners + cancel animations, or call its
 *   `adjustOrigin(dx, dy)` to reposition the live gesture mid-drag.
 * @example
 * ```ts
 * const cleanup = attachDrag(el, { axis: 'x', momentum: true })
 * // …when a layout swap shifts the slot under the cursor mid-drag:
 * cleanup.adjustOrigin(10, -5)
 * // on teardown:
 * cleanup()
 * ```
 */
export const attachDrag = (el: HTMLElement, opts: AttachDragOptions): AttachDragCleanup => {
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
    // Anchor constraints base:
    // - Pixel object constraints are offsets from original origin (0,0)
    // - HTMLElement constraints are measured from current applied transform at drag start
    let constraintsBase = { x: 0, y: 0 }

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

        // Playwright-only sanity check: confirm the transform actually
        // landed on the element and retry once if not. Forces a style
        // recalc via getComputedStyle, so we gate it behind the same
        // playwright env flag pwLog uses so it never fires in prod.
        if (isPlaywrightEnv()) {
            let actualTransform = getComputedStyle(el).transform
            if (actualTransform === 'none' || !actualTransform.includes('matrix')) {
                pwWarn('⚠️ setXY transform missing; retrying write', { x, y })
                animate(
                    el,
                    ('x' in payload || 'y' in payload
                        ? payload
                        : { x, y }) as DOMKeyframesDefinition,
                    { duration: 0 }
                )
                actualTransform = getComputedStyle(el).transform
                if (actualTransform === 'none' || !actualTransform.includes('matrix')) {
                    pwWarn('⚠️ setXY second attempt still missing transform', { x, y })
                }
            }
        }
    }

    /**
     * Write absolute element-space translation by mutating
     * `el.style.transform` DIRECTLY — no `animate()`, no epsilon skip,
     * no Playwright retry. The translate channel is rewritten while any
     * non-translate transform the element already carries (e.g. a
     * `whileDrag` scale) is preserved as a suffix.
     *
     * Why this exists separately from `setXY`: routing through
     * `animate(el, _, { duration: 0 })` defers the write to Motion's
     * scheduler, costing ~1 frame before the new position paints. For
     * the projection-driven origin compensation (where a layout swap
     * must keep the dragged element under the cursor in the SAME frame
     * the swap commits), that frame of lag manifests as a visible
     * wobble. This path lands synchronously. See #379 / the
     * `adjustOrigin` hook below.
     */
    const setXYImmediate = (x: number, y: number) => {
        const parts: string[] = []
        if (axis === true || axis === 'x') parts.push(`translateX(${x}px)`)
        if (axis === true || axis === 'y') parts.push(`translateY(${y}px)`)
        // Strip existing translate channels, keep the rest (scale/rotate/etc.).
        const nonTranslate = el.style.transform.replace(/translate[XYZ3d]*\([^)]*\)/g, '').trim()
        el.style.transform = [...parts, nonTranslate].filter(Boolean).join(' ')
        if (axis === true || axis === 'x') applied.x = x
        if (axis === true || axis === 'y') applied.y = y
    }

    /**
     * Adjust the drag origin + visual offset by a layout-shift delta,
     * mid-gesture, keeping the dragged element pinned under the cursor
     * while its underlying layout slot moves.
     *
     * Direct port of framer-motion's projection `didUpdate` handler in
     * `VisualElementDragControls.ts:742-758`:
     *
     * ```ts
     * this.originPoint[axis] += delta[axis].translate
     * motionValue.set(motionValue.get() + delta[axis].translate)
     * ```
     *
     * We do the same two-write dance: shift `origin` (the gesture's
     * reference zero) AND the applied visual transform by the same
     * delta, so `lastPoint - startPoint + origin` continues to resolve
     * to the correct on-screen position after the layout slot moved.
     * Uses `setXYImmediate` so the compensation is visible the same
     * frame as the layout change.
     *
     * Not wired to any projection node in this PR — exposed on the
     * `attachDrag` return handle for the Reorder PR (#310) to call from
     * its `ProjectionNode.didUpdate` listener.
     *
     * @param dx Layout delta on the x axis (px).
     * @param dy Layout delta on the y axis (px).
     */
    const adjustOrigin = (dx: number, dy: number) => {
        if (!dragging) return
        // Advance the origin only on axes that are actually dragged —
        // setXYImmediate writes (and bumps `applied` for) just those axes,
        // so mutating origin on a locked-out axis would desync origin from
        // applied and corrupt the next `offset = lastPoint - startPoint +
        // origin` resolution.
        if (axis === true || axis === 'x') origin.x += dx
        if (axis === true || axis === 'y') origin.y += dy
        setXYImmediate(applied.x + dx, applied.y + dy)
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
        if (constraints) {
            if (opts.constraints && !isDomElement(opts.constraints as unknown)) {
                // Pixel constraints: always relative to original origin
                constraintsBase = { x: 0, y: 0 }
            } else {
                // HTMLElement constraints: recalc base each drag since layout may change
                constraintsBase = { x: applied.x, y: applied.y }
            }
            pwLog('[drag] constraints-base', {
                el: EL_ID,
                base: { ...constraintsBase },
                applied: { ...applied },
                origin: { ...origin },
                kind:
                    opts.constraints && !isDomElement(opts.constraints as unknown)
                        ? 'pixel'
                        : 'element'
            })
        }

        dragging = true
        lockAxis = null
        // Start from current applied transform, not viewport rect
        origin = { x: applied.x, y: applied.y }
        startPoint = { x: e.clientX, y: e.clientY }
        lastPoint = { ...startPoint }
        velocity = { x: 0, y: 0 }
        history = [{ x: e.clientX, y: e.clientY, t: now() }]

        const applyXAxis = axis === true || axis === 'x'
        const applyYAxis = axis === true || axis === 'y'
        // For external dragControls we avoid snap-to-cursor to prevent teleports
        const useSnapToCursor = snapToCursor && !opts.controls
        if (useSnapToCursor) {
            const rect = el.getBoundingClientRect()
            // Rebase to center under cursor while preserving accumulated transform frame
            const desiredX = e.clientX - rect.width / 2
            const desiredY = e.clientY - rect.height / 2
            if (applyXAxis) origin.x = desiredX
            if (applyYAxis) origin.y = desiredY
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

        const applyX = axis === true || axis === 'x'
        const applyY = axis === true || axis === 'y'

        // Direction lock: only engage if both axes are enabled
        if (directionLock && !lockAxis && Math.hypot(dx, dy) >= lockThreshold && axis === true) {
            lockAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
            pwLog('[drag] directionLock', { el: EL_ID, lockAxis })
            opts.callbacks?.onDirectionLock?.(lockAxis)
        }

        let x = origin.x + (applyX ? dx : 0)
        let y = origin.y + (applyY ? dy : 0)
        const preClamp = { x, y }

        // Respect direction lock (only relevant when axis === true)
        if (lockAxis === 'x') y = origin.y
        if (lockAxis === 'y') x = origin.x

        // Convert to relative translation by clamping within constraints (float-safe)
        if (constraints) {
            const minX = constraintsBase.x + (constraints.left ?? -Infinity)
            const maxX = constraintsBase.x + (constraints.right ?? Infinity)
            const minY = constraintsBase.y + (constraints.top ?? -Infinity)
            const maxY = constraintsBase.y + (constraints.bottom ?? Infinity)
            pwLog('[drag] bounds', {
                el: EL_ID,
                base: { ...constraintsBase },
                bounds: { minX, maxX, minY, maxY },
                preClamp
            })
            x = applyFloatConstraints(x, { min: minX, max: maxX }, elastic)
            y = applyFloatConstraints(y, { min: minY, max: maxY }, elastic)
            pwLog('[drag] constrain+elastic', {
                el: EL_ID,
                preClamp,
                base: { ...constraintsBase },
                bounds: { minX, maxX, minY, maxY },
                elastic,
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
        // Pointer was preempted (gesture-nav, palm rejection, scroll
        // takeover). User did not release intentionally — skip the
        // inertia/momentum path and force a no-momentum settle so the
        // card clamps back into constraints without flinging.
        finishDrag(e, true)
    }

    /**
     * Finish a drag:
     * - If momentum is enabled, decay towards a clamped target with exponential easing
     * - Otherwise, animate back to a clamped position (or origin), then sync `applied`
     */
    const finishDrag = (e: PointerEvent, cancelled = false) => {
        dragging = false

        velocity = computeReleaseVelocity(history, now())

        pwLog('[drag] finish', {
            el: EL_ID,
            lastPoint,
            startPoint,
            origin,
            applied,
            momentum,
            velocity
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

        // Momentum/inertia with boundary handoff: inertia until crossing, then spring to boundary.
        // Pointer-cancel forces a no-momentum settle (clamp into constraints, no fling) since the
        // gesture was preempted rather than intentionally released.
        if (momentum && !cancelled) {
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
                // Cancel hook so re-grab / controls.stop() interrupts the snap.
                stopInertia = () => {
                    pwLog('❌ snapToOrigin cancelled')
                    ;(controls as unknown as { stop?: () => void }).stop?.()
                    // Sync applied to wherever the snap reached so the next drag origin is correct.
                    const { tx, ty } = parseMatrixTranslate(getComputedStyle(el).transform)
                    if (applyX) applied.x = tx
                    if (applyY) applied.y = ty
                    stopInertia = null
                }
                Promise.resolve((controls as unknown as { finished?: Promise<void> }).finished)
                    .then(() => {
                        // Sync internal applied transform so next drag uses the correct origin
                        if (applyX) applied.x = 0
                        if (applyY) applied.y = 0
                        pwLog('[drag] snapToOrigin finished → sync applied', {
                            el: EL_ID,
                            applied
                        })
                        if (stopInertia) stopInertia = null
                    })
                    .catch(() => {})
                    .finally(() => opts.callbacks?.onTransitionEnd?.())
                return
            }

            // Boundary min/max anchor to `constraintsBase` (the absolute
            // pixel-constraint origin) so the inertia handoff snaps to the
            // same edge pointermove's elastic clamping uses — not to a
            // per-drag-shifted `origin` that would drift across drags.
            const noConstraints = !constraints
            const huge = 1e6
            const minX = noConstraints
                ? applied.x - huge
                : constraintsBase.x + (constraints?.left ?? -Infinity)
            const maxX = noConstraints
                ? applied.x + huge
                : constraintsBase.x + (constraints?.right ?? Infinity)
            const minY = noConstraints
                ? applied.y - huge
                : constraintsBase.y + (constraints?.top ?? -Infinity)
            const maxY = noConstraints
                ? applied.y + huge
                : constraintsBase.y + (constraints?.bottom ?? Infinity)

            const { timeConstantMs, restDelta, restSpeed, bounceStiffness, bounceDamping } =
                deriveBoundaryPhysics(elastic, opts.transition)

            pwLog('⚙️ boundary-physics', {
                timeConstantMs,
                restDelta,
                restSpeed,
                bounceStiffness,
                bounceDamping,
                boundsX: { minX, maxX },
                boundsY: { minY, maxY },
                lockAxis,
                axis
            })

            // Respect direction lock on release: only animate the locked axis
            const applyX = (axis === true || axis === 'x') && lockAxis !== 'y'
            const applyY = (axis === true || axis === 'y') && lockAxis !== 'x'

            // Element-ref constraints can resize / reflow during inertia.
            // Pixel constraints never change once set. We re-resolve only
            // for element-ref each frame in the rAF loop below.
            const isElementRefConstraint = isDomElement(opts.constraints as unknown)

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

                // Use the precomputed step functions (built once per release)
                const rx = stepX ? stepX(t) : { value: applied.x, done: true }
                const ry = stepY ? stepY(t) : { value: applied.y, done: true }

                // Element-ref constraints may have resized / reflowed since
                // the steppers were built. Re-resolve and clamp the output
                // so the card never lands outside the now-current container
                // even if its boundary moved mid-spring. Pixel constraints
                // don't move so we skip the work.
                let nextX = rx.value
                let nextY =
                    (axis === true || axis === 'y') && lockAxis !== 'x' ? ry.value : applied.y
                if (isElementRefConstraint) {
                    const freshConstraints = resolveConstraints(el, opts.constraints)
                    if (freshConstraints) {
                        constraintsBase = { x: applied.x, y: applied.y }
                        const freshMinX = constraintsBase.x + (freshConstraints.left ?? -Infinity)
                        const freshMaxX = constraintsBase.x + (freshConstraints.right ?? Infinity)
                        const freshMinY = constraintsBase.y + (freshConstraints.top ?? -Infinity)
                        const freshMaxY = constraintsBase.y + (freshConstraints.bottom ?? Infinity)
                        if (applyX) nextX = Math.max(freshMinX, Math.min(freshMaxX, nextX))
                        if (applyY) nextY = Math.max(freshMinY, Math.min(freshMaxY, nextY))
                    }
                }
                setXY(nextX, nextY)

                if (frameCount <= 3 || frameCount % 10 === 0) {
                    pwLog(`🔄 FRAME ${frameCount}`, {
                        t: t.toFixed(0),
                        px: rx.value.toFixed?.(2) ?? rx.value,
                        py: ry.value.toFixed?.(2) ?? ry.value,
                        doneX: rx.done,
                        doneY: ry.done,
                        boundsX: { minX, maxX },
                        boundsY: { minY, maxY }
                    })
                }

                if ((rx.done || !stepX) && (ry.done || !stepY)) {
                    pwLog('✅ REST REACHED', {
                        frameCount,
                        finalX: nextX,
                        finalY: nextY,
                        timeConstantMs,
                        restDelta,
                        restSpeed
                    })
                    // Sync `applied` from the post-clamp frame values
                    // (nextX/nextY), not the raw stepper output. When
                    // element-ref constraints clamped this frame, raw
                    // rx.value sits outside the visible bounds and would
                    // desync the next-drag origin from the rendered transform.
                    const finalX = stepX ? nextX : applied.x
                    const finalY = stepY ? nextY : applied.y
                    if (axis === true || axis === 'x') applied.x = finalX
                    if (axis === true || axis === 'y') applied.y = finalY
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
                // `applied` is already in sync with the last frame rendered
                // by the rAF loop (setXY updates it on every frame). We
                // intentionally do NOT call stepX/stepY again here —
                // they're stateful (mutate lastT/springX/springV) and an
                // extra call advances them past the visible state, leaving
                // applied slightly out of sync with what the user sees.
                pwLog('[drag] inertia cancelled → sync applied', {
                    el: EL_ID,
                    applied: { x: applied.x, y: applied.y }
                })
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
                const minX = constraintsBase.x + (constraints.left ?? -Infinity)
                const maxX = constraintsBase.x + (constraints.right ?? Infinity)
                const minY = constraintsBase.y + (constraints.top ?? -Infinity)
                const maxY = constraintsBase.y + (constraints.bottom ?? Infinity)
                pwLog('[drag] settle (no momentum) bounds', {
                    el: EL_ID,
                    base: { ...constraintsBase },
                    bounds: { minX, maxX, minY, maxY },
                    preClamp: { x, y }
                })
                x = applyFloatConstraints(x, { min: minX, max: maxX })
                y = applyFloatConstraints(y, { min: minY, max: maxY })
                pwLog('[drag] settle (no momentum) clamped', { el: EL_ID, out: { x, y } })
            }
            pwLog('[drag] settle (no momentum)', {
                el: EL_ID,
                target: { x, y },
                origin,
                applied,
                dx,
                dy,
                elastic
            })

            // When elastic=0, the element is already at the clamped position during drag,
            // so use instant settle (duration: 0) to avoid spring bounce.
            // Otherwise use the merged transition for smooth settle animation.
            const settleTransition =
                elastic === 0 ? { duration: 0 } : ((mergedTransition ?? {}) as AnimationOptions)

            // Animate with the merged transition so the settle feels consistent with other motion
            const controls = animate(
                el,
                { ...(applyX ? { x } : {}), ...(applyY ? { y } : {}) } as DOMKeyframesDefinition,
                settleTransition
            )
            // Cancel hook so re-grab interrupts the settle animation cleanly.
            stopInertia = () => {
                pwLog('❌ settle (no momentum) cancelled')
                ;(controls as unknown as { stop?: () => void }).stop?.()
                const { tx, ty } = parseMatrixTranslate(getComputedStyle(el).transform)
                if (applyX) applied.x = tx
                if (applyY) applied.y = ty
                stopInertia = null
            }
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
                    if (stopInertia) stopInertia = null
                })
                .catch(() => {})
                .finally(() => opts.callbacks?.onTransitionEnd?.())
        }

        opts.callbacks?.onEnd?.(e, computeInfo())
        endWhileDrag()
    }

    // Wire dragControls. The cancelInertia thunk reads the *current*
    // stopInertia at call time so the latest in-flight animation is
    // targeted (stopInertia is re-assigned per finishDrag).
    if (opts.controls) {
        const internal = opts.controls as unknown as {
            _bind?: (
                el: HTMLElement,
                starter: (e: PointerEvent, snap?: boolean) => void,
                cancelInertia?: () => void
            ) => void
        }
        internal._bind?.(el, beginDrag, () => stopInertia?.())
        pwLog('[drag] controls bound', { el: EL_ID })
    }

    el.addEventListener('pointerdown', onPointerDown)
    pwLog('[drag] pointerdown listener attached', { el: EL_ID })

    const teardown = () => {
        pwLog('[drag] detach', { el: EL_ID })
        el.removeEventListener('pointerdown', onPointerDown)
        el.removeEventListener('pointermove', onPointerMove as EventListener)
        el.removeEventListener('pointerup', onPointerUp as EventListener)
        el.removeEventListener('pointercancel', onPointerCancel as EventListener)
        window.removeEventListener('pointermove', onPointerMove as EventListener)
        window.removeEventListener('pointerup', onPointerUp as EventListener)
        window.removeEventListener('pointercancel', onPointerCancel as EventListener)
    }

    return Object.assign(teardown, { adjustOrigin }) as AttachDragCleanup
}
