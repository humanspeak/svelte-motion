import type {
    DragAxis,
    DragConstraints,
    DragControls,
    DragElastic,
    DragInfo,
    MotionWhileDrag
} from '$lib/types'
import { pwLog } from '$lib/utils/log'
/**
 * Drag utilities
 *
 * This module implements low-level drag gesture handling that powers `motion.*` components.
 * It intentionally avoids Svelte-specific APIs so it can be reused in action-like contexts.
 *
 * Troubleshooting tips when drag "doesn't move":
 * - Ensure we are writing transforms via the synchronous drag transform writer.
 *   If computed style shows `transform: none`, another CSS rule may be overwriting the transform.
 * - Confirm `axis` allows the intended direction (true | 'x' | 'y').
 * - If using constraints as HTMLElement, verify both element and constraint refs are non-null and connected.
 * - If movement stops immediately, direction lock may be engaged. Try disabling `directionLock`.
 * - If post-release momentum never kicks in, velocity history may be empty (e.g., only pointerdown/up).
 *   Simulate a few `pointermove`s before releasing.
 * - For nested drags, set `propagation` as needed to avoid parent-child contention.
 */
import { isDomElement } from '$lib/utils/dom'
import { startDragInertia } from '$lib/utils/dragInertia'
import {
    applyConstraints as applyFloatConstraints,
    parseMatrixTranslate
} from '$lib/utils/dragMath'
import { deriveBoundaryPhysics } from '$lib/utils/dragParams'
import { computeHoverBaseline, splitHoverDefinition } from '$lib/utils/hover'
import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'
import { animateValue, type AnimationPlaybackControlsWithThen, type MotionValue } from 'motion-dom'

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
    elastic?: DragElastic
    momentum?: boolean
    transition?: {
        bounceStiffness?: number
        bounceDamping?: number
        power?: number
        timeConstant?: number
        restDelta?: number
        restSpeed?: number
        modifyTarget?: (target: number) => number
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
        onVisualUpdate?: (transform: string) => void
    }
    baselineSources?: { initial?: Record<string, unknown>; animate?: Record<string, unknown> }
    getBaseTransform?: () => string
    propagation?: boolean
    snapToOrigin?: boolean | 'x' | 'y'
    /**
     * Bound `style` MotionValues for the dragged axes (e.g. `style={{ y }}`).
     * The gesture dual-writes these alongside the synchronous transform so
     * `y.get()` / `style={{ y }}` reflect the live drag offset and a follow-up
     * `animate(y, …)` continues from the dragged position — matching
     * framer-motion, where the gesture drives the MotionValue and the transform
     * is derived from it (#421).
     */
    boundMotionValues?: { x?: MotionValue<number>; y?: MotionValue<number> }
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

const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max)

const mix = (min: number, max: number, progress: number): number => min + (max - min) * progress

type ResolvedDragElastic = {
    x: { min: number; max: number }
    y: { min: number; max: number }
}

const defaultElastic = 0.35

const clampElastic = (value: number): number => Math.max(0, Math.min(1, value))

type NormalizedDragElastic = number | Exclude<DragElastic, boolean | number>

const resolvePointElastic = (
    elastic: NormalizedDragElastic,
    key: 'left' | 'right' | 'top' | 'bottom'
) => (typeof elastic === 'number' ? elastic : (elastic[key] ?? 0))

const resolveAxisElastic = (
    elastic: NormalizedDragElastic,
    minKey: 'left' | 'top',
    maxKey: 'right' | 'bottom'
) => ({
    min: clampElastic(resolvePointElastic(elastic, minKey)),
    max: clampElastic(resolvePointElastic(elastic, maxKey))
})

const resolveDragElastic = (elastic: DragElastic = defaultElastic): ResolvedDragElastic => {
    if (elastic === false) elastic = 0
    if (elastic === true) elastic = defaultElastic

    return {
        x: resolveAxisElastic(elastic, 'left', 'right'),
        y: resolveAxisElastic(elastic, 'top', 'bottom')
    }
}

const getMaxElastic = (elastic: ResolvedDragElastic): number =>
    Math.max(elastic.x.min, elastic.x.max, elastic.y.min, elastic.y.max)

const calcConstraintProgress = (value: number, min: number, max: number): number | null => {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null
    if (max === min) return 0
    return clamp((value - min) / (max - min), 0, 1)
}

/**
 * Resolves a per-side elastic factor and clamps it to the valid range.
 * @param elastic Either a uniform elastic value, side-specific factors, or undefined.
 * @param side The constrained side whose factor should be read.
 * @returns The elastic factor clamped between 0 and 1.
 * @example
 * ```ts
 * getElasticFactor({ min: 0.2, max: 0.5 }, 'max') // 0.5
 * ```
 */
const getElasticFactor = (
    elastic: { min: number; max: number } | number | undefined,
    side: 'min' | 'max'
): number => {
    if (elastic == null) return 0
    const value = typeof elastic === 'number' ? elastic : elastic[side]
    return clampElastic(value)
}

/**
 * Applies constraints while preserving continuity for a drag that starts outside bounds.
 *
 * When the drag origin is already beyond a constraint edge, additional movement farther
 * beyond that same edge stretches from the caught origin rather than recalculating from
 * the original boundary. Movement back through the valid range falls back to normal
 * float-safe constraint handling.
 *
 * @param value The unconstrained target value for the current pointer position.
 * @param dragOrigin The applied transform at the start of the current drag.
 * @param range Constraint bounds for the current axis.
 * @param elastic Either a uniform elastic value, side-specific factors, or undefined.
 * @returns The constrained value to render for the active drag frame.
 * @example
 * ```ts
 * applyDragOriginConstraints(220, 180, { min: -120, max: 120 }, { min: 0, max: 0.5 })
 * // 200: starts outside the max bound at 180 and stretches halfway toward 220.
 * ```
 */
const applyDragOriginConstraints = (
    value: number,
    dragOrigin: number,
    range: { min: number; max: number },
    elastic: { min: number; max: number } | number | undefined
): number => {
    const hasMin = Number.isFinite(range.min)
    const hasMax = Number.isFinite(range.max)

    if (hasMax && dragOrigin > range.max) {
        if (value >= dragOrigin) {
            return dragOrigin + (value - dragOrigin) * getElasticFactor(elastic, 'max')
        }
        if (!hasMin || value >= range.min) return value
        return applyFloatConstraints(value, range, elastic)
    }

    if (hasMin && dragOrigin < range.min) {
        if (value <= dragOrigin) {
            return dragOrigin + (value - dragOrigin) * getElasticFactor(elastic, 'min')
        }
        if (!hasMax || value <= range.max) return value
        return applyFloatConstraints(value, range, elastic)
    }

    return applyFloatConstraints(value, range, elastic)
}

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

    for (let newestIdx = history.length - 1; newestIdx > 0; newestIdx--) {
        const newest = history[newestIdx]
        if (nowMs - newest.t > MAX_VELOCITY_DELTA_MS) return { x: 0, y: 0 }

        let oldestIdx = newestIdx
        for (let i = newestIdx - 1; i >= 0; i--) {
            if (newest.t - history[i].t > MAX_VELOCITY_DELTA_MS) break
            oldestIdx = i
        }

        if (oldestIdx === newestIdx) continue

        const oldest = history[oldestIdx]
        const dtMs = newest.t - oldest.t
        if (dtMs < MIN_VELOCITY_INTERVAL_MS) continue

        return {
            x: ((newest.x - oldest.x) / dtMs) * 1000,
            y: ((newest.y - oldest.y) / dtMs) * 1000
        }
    }

    return { x: 0, y: 0 }
}

/**
 * Cleanup handle returned by {@link attachDrag}. Invoke it to detach the
 * gesture's pointer/resize listeners. It does NOT cancel an in-flight
 * momentum/settle animation — matching framer-motion, whose drag teardown
 * removes listeners only and deliberately lets motion continue across an
 * unmount/remount (e.g. reorder reconciliation); the animation is cleaned
 * up by the element/motion-value lifecycle.
 *
 * The handle also carries `adjustOrigin(dx, dy)`, which shifts the LIVE
 * gesture's origin + visual offset by a layout-shift delta mid-drag — used
 * for projection-driven cursor pinning when a layout slot moves under the
 * dragged element (#379 / #310). It is a no-op when not currently dragging
 * and compensates on both axes (mirroring upstream's per-axis `eachAxis`
 * compensation).
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
 *   to detach the gesture's listeners (in-flight momentum is not
 *   cancelled — see the type docs), or call its `adjustOrigin(dx, dy)` to
 *   reposition the live gesture mid-drag.
 * @example
 * ```ts
 * const cleanup = attachDrag(el, { axis: 'x', momentum: true })
 * // …when a layout swap shifts the slot under the cursor mid-drag:
 * cleanup.adjustOrigin(10, -5)
 * // on teardown:
 * cleanup()
 * ```
 */
/**
 * Options for the window-level gesture-session listeners. Capture phase
 * guarantees the gesture ends even when a descendant stops propagation
 * of `pointerup`/`pointercancel`; passive because the handlers never
 * call `preventDefault`. Mirrors upstream PanSession (motion#3731).
 */
const sessionListenerOptions: AddEventListenerOptions = { passive: true, capture: true }

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
    const dragX = axis === true || axis === 'x'
    const dragY = axis === true || axis === 'y'
    // Bound `style` MotionValues for the dragged axes (e.g. `style={{ y }}`).
    // Constant for this gesture's lifetime, so resolved once here rather than
    // per `setXYImmediate` frame (#421).
    const boundX = dragX ? opts.boundMotionValues?.x : undefined
    const boundY = dragY ? opts.boundMotionValues?.y : undefined
    const directionLock = !!opts.directionLock
    const listenerEnabled = opts.listener !== false
    const elastic = resolveDragElastic(opts.elastic)
    const maxElastic = getMaxElastic(elastic)
    const momentum = opts.momentum !== false
    const mergedTransition = opts.mergedTransition ?? {}

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
    let transformComposerRaf = 0
    let transformComposerActive = false
    let postReleaseAnimationActive = false
    let whileDragRestoreActive = false
    let managedScaleActive = false
    let managedScale = 1
    let scaleAnimation: AnimationPlaybackControlsWithThen | null = null
    let stopInertia: (() => void) | null = null

    const markDragTransformActive = (active: boolean) => {
        if (active) {
            el.dataset.svelteMotionDragActive = 'true'
        } else {
            delete el.dataset.svelteMotionDragActive
        }
    }

    const computeInfo = (): DragInfo => ({
        point: { ...lastPoint },
        delta: { x: lastPoint.x - startPoint.x, y: lastPoint.y - startPoint.y },
        offset: {
            x: origin.x + (lastPoint.x - startPoint.x),
            y: origin.y + (lastPoint.y - startPoint.y)
        },
        velocity: { ...velocity }
    })

    const getConstraintBounds = (
        base: { x: number; y: number },
        currentConstraints: { top: number; left: number; right: number; bottom: number }
    ) => ({
        minX: base.x + (currentConstraints.left ?? -Infinity),
        maxX: base.x + (currentConstraints.right ?? Infinity),
        minY: base.y + (currentConstraints.top ?? -Infinity),
        maxY: base.y + (currentConstraints.bottom ?? Infinity)
    })

    const scalePositionWithinConstraints = () => {
        if (dragging || !constraints) return
        const isElementRefConstraint = isDomElement(opts.constraints)
        if (!isElementRefConstraint) return

        const oldBounds = getConstraintBounds(constraintsBase, constraints)
        if (stopInertia) stopInertia()
        const progressX = calcConstraintProgress(applied.x, oldBounds.minX, oldBounds.maxX)
        const progressY = calcConstraintProgress(applied.y, oldBounds.minY, oldBounds.maxY)

        const freshConstraints = resolveConstraints(el, opts.constraints)
        if (!freshConstraints) return

        constraints = freshConstraints
        constraintsBase = { x: applied.x, y: applied.y }
        const applyX = axis === true || axis === 'x'
        const applyY = axis === true || axis === 'y'
        const { minX, maxX, minY, maxY } = getConstraintBounds(constraintsBase, freshConstraints)
        const nextX = applyX
            ? progressX == null
                ? applyFloatConstraints(applied.x, { min: minX, max: maxX })
                : mix(minX, maxX, progressX)
            : applied.x
        const nextY = applyY
            ? progressY == null
                ? applyFloatConstraints(applied.y, { min: minY, max: maxY })
                : mix(minY, maxY, progressY)
            : applied.y

        if (nextX === applied.x && nextY === applied.y) return
        pwLog('[drag] constraints resized → scale position', {
            el: EL_ID,
            bounds: { minX, maxX, minY, maxY },
            progress: { x: progressX, y: progressY },
            from: { ...applied },
            to: { x: nextX, y: nextY }
        })
        setXYImmediate(nextX, nextY)
    }

    const stopConstraintResizeObserver =
        isDomElement(opts.constraints) && typeof ResizeObserver !== 'undefined'
            ? (() => {
                  const observer = new ResizeObserver(() => scalePositionWithinConstraints())
                  observer.observe(el)
                  observer.observe(opts.constraints)
                  return () => observer.disconnect()
              })()
            : null

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
        // An axis backed by a bound MotionValue is rendered through motion-dom's
        // styleEffect (and reflected in `getBaseTransform()`). Emitting a translate
        // for it here too would apply the offset twice (#421), so only non-bound
        // axes get the synchronous, no-lag translate write (#379).
        const parts: string[] = []
        if (dragX && !boundX) parts.push(`translateX(${x}px)`)
        if (dragY && !boundY) parts.push(`translateY(${y}px)`)
        const scalePart =
            managedScaleActive && Math.abs(managedScale - 1) > 0.0001
                ? `scale(${managedScale})`
                : ''
        const liveTransform = [...parts, scalePart].filter(Boolean).join(' ')

        // `liveTransform` is empty only when every dragged axis is
        // MotionValue-backed and there's no managed scale — i.e. nothing here to
        // write, so styleEffect owns the transform and writing an empty/stale
        // value would clobber it (#421). Otherwise this is the unchanged no-lag
        // write path (#379) — note a no-bound drag always has a translate, so
        // `liveTransform` is non-empty and the write always runs.
        if (liveTransform) {
            el.dataset.svelteMotionDragTransform = liveTransform
            const writeComposedTransform = () => {
                if (el.dataset.svelteMotionDragTransform !== liveTransform) return
                const baseTransform = opts.getBaseTransform?.() ?? ''
                el.style.transform = [liveTransform, baseTransform].filter(Boolean).join(' ')
            }

            writeComposedTransform()
            queueMicrotask(writeComposedTransform)
            requestAnimationFrame(writeComposedTransform)
        }
        if (dragX) applied.x = x
        if (dragY) applied.y = y
        // Dual-write the bound MotionValue(s) so `y.get()`, `style={{ y }}`, and a
        // follow-up `animate(y, …)` stay in sync with the drag (#421).
        if (boundX && boundX.get() !== x) boundX.set(x)
        if (boundY && boundY.get() !== y) boundY.set(y)
        opts.callbacks?.onVisualUpdate?.(liveTransform)
    }

    const startTransformComposer = () => {
        if (transformComposerActive) return
        transformComposerActive = true

        const tick = () => {
            if (!transformComposerActive) return
            setXYImmediate(applied.x, applied.y)
            transformComposerRaf = requestAnimationFrame(tick)
        }

        transformComposerRaf = requestAnimationFrame(tick)
    }

    const stopTransformComposer = () => {
        transformComposerActive = false
        if (!transformComposerRaf) return
        cancelAnimationFrame(transformComposerRaf)
        transformComposerRaf = 0
    }

    const maybeStopTransformComposer = () => {
        if (dragging || postReleaseAnimationActive || whileDragRestoreActive) return

        requestAnimationFrame(() => {
            if (dragging || postReleaseAnimationActive || whileDragRestoreActive) return
            setXYImmediate(applied.x, applied.y)
            stopTransformComposer()
            markDragTransformActive(false)
        })
    }

    const readCurrentScale = () => {
        const transform = getComputedStyle(el).transform
        if (!transform || transform === 'none') return 1
        const matrix = transform.match(/matrix\(([^)]+)\)/)
        if (!matrix) return 1
        const [a, b] = matrix[1]
            .split(',')
            .map((part) => Number.parseFloat(part.trim()))
            .slice(0, 2)
        if (!Number.isFinite(a)) return 1
        if (!Number.isFinite(b)) return a
        return Math.hypot(a, b)
    }

    const animateManagedScale = (
        target: unknown,
        transition: AnimationOptions | undefined,
        onComplete?: () => void
    ) => {
        const targetScale = Number(Array.isArray(target) ? target[target.length - 1] : target)
        if (!Number.isFinite(targetScale)) {
            onComplete?.()
            return null
        }

        scaleAnimation?.stop()
        managedScaleActive = true
        managedScale = readCurrentScale()
        const valueTransition = {
            ...((transition ?? mergedTransition ?? {}) as Record<string, unknown>)
        }
        if (typeof valueTransition.duration === 'number') {
            valueTransition.duration = valueTransition.duration * 1000
        }
        if (typeof valueTransition.delay === 'number') {
            valueTransition.delay = valueTransition.delay * 1000
        }
        if (typeof valueTransition.repeatDelay === 'number') {
            valueTransition.repeatDelay = valueTransition.repeatDelay * 1000
        }

        const controls = animateValue({
            ...valueTransition,
            keyframes: [managedScale, targetScale],
            onUpdate: (value: number) => {
                managedScale = value
                setXYImmediate(applied.x, applied.y)
            },
            onComplete: () => {
                managedScale = targetScale
                setXYImmediate(applied.x, applied.y)
                onComplete?.()
            }
        })
        scaleAnimation = controls
        return controls
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
        // Compensate the origin on BOTH axes unconditionally — upstream's
        // didUpdate handler applies the delta per-axis via `eachAxis`
        // regardless of the drag axis or direction lock, because a layout
        // slot can shift on either axis.
        origin.x += dx
        origin.y += dy
        // The VISUAL write is `setXYImmediate`, which only writes the axis
        // this drag manages (`opts.axis`). For the dragged axis that pins
        // the element same-frame; the cross-axis case (e.g. drag="x" + a
        // y-shift) only updates `origin`, not the transform. Fully
        // rendering cross-axis compensation needs to route through the
        // Motion value the move path uses (a direct write here would be
        // wiped by the next `setXY`), so it's finalized when this hook is
        // wired in #310. The common Reorder case (drag axis === the shift
        // axis) is fully compensated today.
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
        startTransformComposer()
        const { scale, ...nativeKeyframes } = keyframes
        if (scale != null) animateManagedScale(scale, transition)
        if (Object.keys(nativeKeyframes).length > 0) {
            animate(el, nativeKeyframes as DOMKeyframesDefinition, transition ?? mergedTransition)
        }
    }

    const endWhileDrag = () => {
        const baseline = whileDragBaseline
        if (!baseline || Object.keys(baseline).length === 0) {
            maybeStopTransformComposer()
            return
        }
        whileDragRestoreActive = true
        const { scale, ...nativeBaseline } = baseline
        const restore =
            Object.keys(nativeBaseline).length > 0
                ? animate(el, nativeBaseline as unknown as DOMKeyframesDefinition, mergedTransition)
                : null
        whileDragBaseline = null

        const finishRestore = () => {
            whileDragRestoreActive = false
            if (managedScaleActive && Math.abs(managedScale - 1) <= 0.0001) {
                managedScale = 1
                setXYImmediate(applied.x, applied.y)
                managedScaleActive = false
            }
            maybeStopTransformComposer()
        }

        const scaleRestore =
            scale != null || managedScaleActive
                ? animateManagedScale(scale ?? 1, mergedTransition, () => {
                      managedScale = Number(scale ?? 1)
                      if (Math.abs(managedScale - 1) <= 0.0001) {
                          managedScale = 1
                          setXYImmediate(applied.x, applied.y)
                          managedScaleActive = false
                      }
                  })
                : null

        const restorePromises: PromiseLike<unknown>[] = []
        for (const control of [restore, scaleRestore]) {
            if (control && typeof (control as PromiseLike<unknown>).then === 'function') {
                restorePromises.push(control as PromiseLike<unknown>)
            }
        }

        if (restorePromises.length > 0) {
            Promise.allSettled(restorePromises).then(finishRestore)
            return
        }

        finishRestore()
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
            if (opts.constraints && !isDomElement(opts.constraints)) {
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
                kind: opts.constraints && !isDomElement(opts.constraints) ? 'pixel' : 'element'
            })
        }

        dragging = true
        el.dispatchEvent(new CustomEvent('svelte-motion:drag-start'))
        markDragTransformActive(true)
        lockAxis = null
        // Start from current applied transform, not viewport rect
        origin = { x: applied.x, y: applied.y }
        startPoint = { x: e.clientX, y: e.clientY }
        lastPoint = { ...startPoint }
        velocity = { x: 0, y: 0 }
        history = [{ x: e.clientX, y: e.clientY, t: now() }]
        startTransformComposer()

        const applyXAxis = axis === true || axis === 'x'
        const applyYAxis = axis === true || axis === 'y'
        if (snapToCursor) {
            const rendered = parseMatrixTranslate(getComputedStyle(el).transform)
            const base = parseMatrixTranslate(opts.getBaseTransform?.() ?? '')
            if (applyXAxis) applied.x = rendered.tx - base.tx
            if (applyYAxis) applied.y = rendered.ty - base.ty
            const rect = el.getBoundingClientRect()
            const centerX = rect.left + rect.width / 2
            const centerY = rect.top + rect.height / 2
            if (applyXAxis) origin.x = applied.x + e.clientX - centerX
            if (applyYAxis) origin.y = applied.y + e.clientY - centerY
            setXYImmediate(origin.x, origin.y)
            pwLog('[drag] snapToCursor origin', { el: EL_ID, origin })
        }

        startWhileDrag()
        opts.callbacks?.onStart?.(e, computeInfo())

        // Listen on element (to receive captured events) and window as fallback.
        // Window listeners run in the CAPTURE phase so a descendant calling
        // stopPropagation() (e.g. in its own pointerup handler) can't prevent
        // the gesture from ending. Mirrors upstream PanSession (motion#3731).
        el.addEventListener('pointermove', onPointerMove as EventListener)
        el.addEventListener('pointerup', onPointerUp as EventListener)
        el.addEventListener('pointercancel', onPointerCancel as EventListener)
        window.addEventListener(
            'pointermove',
            onPointerMove as EventListener,
            sessionListenerOptions
        )
        window.addEventListener('pointerup', onPointerUp as EventListener, sessionListenerOptions)
        window.addEventListener(
            'pointercancel',
            onPointerCancel as EventListener,
            sessionListenerOptions
        )
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
            x = applyDragOriginConstraints(x, origin.x, { min: minX, max: maxX }, elastic.x)
            y = applyDragOriginConstraints(y, origin.y, { min: minY, max: maxY }, elastic.y)
            pwLog('[drag] constrain+elastic', {
                el: EL_ID,
                preClamp,
                base: { ...constraintsBase },
                bounds: { minX, maxX, minY, maxY },
                elastic,
                out: { x, y }
            })
        }

        // Apply absolute transform in element space. Pointermove must paint
        // in the same frame as the event; Motion's zero-duration animate()
        // path schedules the write and can leave the element visibly chasing
        // the pointer on dense/rotated drag surfaces.
        setXYImmediate(x, y)
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
        postReleaseAnimationActive = false

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
        window.removeEventListener(
            'pointermove',
            onPointerMove as EventListener,
            sessionListenerOptions
        )
        window.removeEventListener(
            'pointerup',
            onPointerUp as EventListener,
            sessionListenerOptions
        )
        window.removeEventListener(
            'pointercancel',
            onPointerCancel as EventListener,
            sessionListenerOptions
        )

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

            const { power, timeConstant, restDelta, restSpeed, bounceStiffness, bounceDamping } =
                deriveBoundaryPhysics(maxElastic, opts.transition)

            pwLog('⚙️ boundary-physics', {
                power,
                timeConstant,
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

            let latestX = applied.x
            let latestY = applied.y
            let frameCount = 0
            let running = true
            postReleaseAnimationActive = true
            const animations: AnimationPlaybackControlsWithThen[] = []
            let remainingAnimations = (applyX ? 1 : 0) + (applyY ? 1 : 0)
            const transitionMin = opts.transition?.min
            const transitionMax = opts.transition?.max
            const snapX = opts.snapToOrigin === true || opts.snapToOrigin === 'x'
            const snapY = opts.snapToOrigin === true || opts.snapToOrigin === 'y'
            const inertiaMinX = snapX ? 0 : (transitionMin ?? (noConstraints ? undefined : minX))
            const inertiaMaxX = snapX ? 0 : (transitionMax ?? (noConstraints ? undefined : maxX))
            const inertiaMinY = snapY ? 0 : (transitionMin ?? (noConstraints ? undefined : minY))
            const inertiaMaxY = snapY ? 0 : (transitionMax ?? (noConstraints ? undefined : maxY))
            const finalMinX = snapX ? 0 : minX
            const finalMaxX = snapX ? 0 : maxX
            const finalMinY = snapY ? 0 : minY
            const finalMaxY = snapY ? 0 : maxY

            const renderLatest = () => {
                if (!running) return
                frameCount++
                setXYImmediate(latestX, latestY)

                if (frameCount <= 3 || frameCount % 10 === 0) {
                    pwLog(`🔄 FRAME ${frameCount}`, {
                        px: latestX.toFixed?.(2) ?? latestX,
                        py: latestY.toFixed?.(2) ?? latestY,
                        boundsX: { minX, maxX },
                        boundsY: { minY, maxY }
                    })
                }
            }

            const completeAxis = () => {
                if (!running) return
                remainingAnimations--
                if (remainingAnimations > 0) return

                if (applyX)
                    applied.x = applyFloatConstraints(latestX, { min: finalMinX, max: finalMaxX })
                if (applyY)
                    applied.y = applyFloatConstraints(latestY, { min: finalMinY, max: finalMaxY })
                setXYImmediate(applied.x, applied.y)

                pwLog('✅ REST REACHED', {
                    frameCount,
                    finalX: applied.x,
                    finalY: applied.y,
                    power,
                    timeConstant,
                    restDelta,
                    restSpeed
                })

                running = false
                stopInertia = null
                postReleaseAnimationActive = false
                maybeStopTransformComposer()
                opts.callbacks?.onTransitionEnd?.()
            }

            if (applyX) {
                animations.push(
                    startDragInertia(
                        {
                            value: applied.x,
                            velocity: velocity.x,
                            min: inertiaMinX,
                            max: inertiaMaxX,
                            power,
                            timeConstant,
                            restDelta,
                            restSpeed,
                            modifyTarget: opts.transition?.modifyTarget,
                            bounceStiffness,
                            bounceDamping
                        },
                        {
                            onUpdate: (value) => {
                                latestX = value
                                renderLatest()
                            },
                            onComplete: completeAxis
                        }
                    )
                )
            }

            if (applyY) {
                animations.push(
                    startDragInertia(
                        {
                            value: applied.y,
                            velocity: velocity.y,
                            min: inertiaMinY,
                            max: inertiaMaxY,
                            power,
                            timeConstant,
                            restDelta,
                            restSpeed,
                            modifyTarget: opts.transition?.modifyTarget,
                            bounceStiffness,
                            bounceDamping
                        },
                        {
                            onUpdate: (value) => {
                                latestY = value
                                renderLatest()
                            },
                            onComplete: completeAxis
                        }
                    )
                )
            }

            if (!animations.length) {
                postReleaseAnimationActive = false
                maybeStopTransformComposer()
                opts.callbacks?.onTransitionEnd?.()
                return
            }

            stopInertia = () => {
                pwLog('❌ MOMENTUM CANCELLED')
                running = false
                for (const animation of animations) animation.stop()
                if (applyX) applied.x = latestX
                if (applyY) applied.y = latestY
                setXYImmediate(applied.x, applied.y)
                postReleaseAnimationActive = false
                maybeStopTransformComposer()
                pwLog('[drag] inertia cancelled → sync applied', {
                    el: EL_ID,
                    applied: { x: applied.x, y: applied.y }
                })
                stopInertia = null
            }

            pwLog('🏁 STARTED MOTION-DOM INERTIA', {
                animations: animations.length,
                applyX,
                applyY
            })
        } else {
            // No momentum: spring from the rendered overdrag value back to
            // the clamped target. This must use the same direct transform
            // writer as active drag so release doesn't snap through Motion's
            // separate DOM animation state.
            const applyX = (axis === true || axis === 'x') && lockAxis !== 'y'
            const applyY = (axis === true || axis === 'y') && lockAxis !== 'x'
            const dx = lastPoint.x - startPoint.x
            const dy = lastPoint.y - startPoint.y
            let x = origin.x + (applyX ? dx : 0)
            let y = origin.y + (applyY ? dy : 0)
            let minX = -Infinity
            let maxX = Infinity
            let minY = -Infinity
            let maxY = Infinity

            // Respect direction lock
            if (lockAxis === 'x') y = origin.y
            if (lockAxis === 'y') x = origin.x

            if (constraints) {
                minX = constraintsBase.x + (constraints.left ?? -Infinity)
                maxX = constraintsBase.x + (constraints.right ?? Infinity)
                minY = constraintsBase.y + (constraints.top ?? -Infinity)
                maxY = constraintsBase.y + (constraints.bottom ?? Infinity)
                pwLog('[drag] settle (no momentum) bounds', {
                    el: EL_ID,
                    base: { ...constraintsBase },
                    bounds: { minX, maxX, minY, maxY },
                    preClamp: { x, y }
                })
            }

            const snapX = opts.snapToOrigin === true || opts.snapToOrigin === 'x'
            const snapY = opts.snapToOrigin === true || opts.snapToOrigin === 'y'
            if (snapX) {
                x = 0
                minX = 0
                maxX = 0
            } else if (constraints && applyX) {
                x = applyFloatConstraints(x, { min: minX, max: maxX })
            }
            if (snapY) {
                y = 0
                minY = 0
                maxY = 0
            } else if (constraints && applyY) {
                y = applyFloatConstraints(y, { min: minY, max: maxY })
            }
            if (constraints)
                pwLog('[drag] settle (no momentum) clamped', { el: EL_ID, out: { x, y } })
            pwLog('[drag] settle (no momentum)', {
                el: EL_ID,
                target: { x, y },
                origin,
                applied,
                dx,
                dy,
                elastic
            })

            postReleaseAnimationActive = true
            let latestX = applied.x
            let latestY = applied.y
            let running = true
            const animations: AnimationPlaybackControlsWithThen[] = []
            const { timeConstant, restDelta, restSpeed, bounceStiffness, bounceDamping } =
                deriveBoundaryPhysics(maxElastic, opts.transition)

            const renderLatest = () => {
                if (!running) return
                setXYImmediate(latestX, latestY)
            }

            if (cancelled) {
                if (applyX) latestX = x
                if (applyY) latestY = y
                setXYImmediate(latestX, latestY)
                postReleaseAnimationActive = false
                maybeStopTransformComposer()
                opts.callbacks?.onTransitionEnd?.()
                return
            }

            const finishSettle = () => {
                if (!running) return
                if (applyX) applied.x = applyFloatConstraints(latestX, { min: minX, max: maxX })
                if (applyY) applied.y = applyFloatConstraints(latestY, { min: minY, max: maxY })
                setXYImmediate(applied.x, applied.y)
                running = false
                stopInertia = null
                postReleaseAnimationActive = false
                maybeStopTransformComposer()
                opts.callbacks?.onTransitionEnd?.()
            }

            let remainingAnimations = 0
            const completeAxis = () => {
                remainingAnimations--
                if (remainingAnimations <= 0) finishSettle()
            }

            const addSettleAnimation = (
                from: number,
                to: number,
                min: number,
                max: number,
                onUpdate: (value: number) => void
            ) => {
                const shouldSpringBoundary = from < min || from > max
                if (Math.abs(from - to) < 0.01 && !shouldSpringBoundary) {
                    onUpdate(to)
                    return
                }

                remainingAnimations++
                animations.push(
                    shouldSpringBoundary
                        ? startDragInertia(
                              {
                                  value: from,
                                  velocity: 0,
                                  min,
                                  max,
                                  power: 0,
                                  timeConstant,
                                  restDelta,
                                  restSpeed,
                                  bounceStiffness,
                                  bounceDamping
                              },
                              { onUpdate, onComplete: completeAxis }
                          )
                        : animateValue({
                              keyframes: [from, to],
                              type: 'spring',
                              stiffness: bounceStiffness,
                              damping: bounceDamping,
                              restDelta,
                              restSpeed,
                              onUpdate,
                              onComplete: completeAxis
                          })
                )
            }

            stopInertia = () => {
                pwLog('❌ settle (no momentum) cancelled')
                running = false
                for (const animation of animations) animation.stop()
                if (applyX) applied.x = latestX
                if (applyY) applied.y = latestY
                setXYImmediate(applied.x, applied.y)
                postReleaseAnimationActive = false
                maybeStopTransformComposer()
                stopInertia = null
            }

            if (maxElastic === 0) {
                latestX = applyX ? x : applied.x
                latestY = applyY ? y : applied.y
                finishSettle()
            } else {
                if (applyX) {
                    addSettleAnimation(applied.x, x, minX, maxX, (value) => {
                        latestX = value
                        renderLatest()
                    })
                }
                if (applyY) {
                    addSettleAnimation(applied.y, y, minY, maxY, (value) => {
                        latestY = value
                        renderLatest()
                    })
                }

                if (!animations.length) {
                    finishSettle()
                }
            }
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
        markDragTransformActive(false)
        stopTransformComposer()
        scaleAnimation?.stop()
        stopConstraintResizeObserver?.()
        el.removeEventListener('pointerdown', onPointerDown)
        el.removeEventListener('pointermove', onPointerMove as EventListener)
        el.removeEventListener('pointerup', onPointerUp as EventListener)
        el.removeEventListener('pointercancel', onPointerCancel as EventListener)
        window.removeEventListener(
            'pointermove',
            onPointerMove as EventListener,
            sessionListenerOptions
        )
        window.removeEventListener(
            'pointerup',
            onPointerUp as EventListener,
            sessionListenerOptions
        )
        window.removeEventListener(
            'pointercancel',
            onPointerCancel as EventListener,
            sessionListenerOptions
        )
    }

    return Object.assign(teardown, { adjustOrigin })
}
