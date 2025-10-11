import type { DragAxis, DragConstraints, DragControls, DragInfo, MotionWhileDrag } from '$lib/types'
import { computeHoverBaseline, splitHoverDefinition } from '$lib/utils/hover'
import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'

type Rect = {
    top: number
    left: number
    right: number
    bottom: number
    width: number
    height: number
}

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
export const applyElastic = (value: number, min: number, max: number, elastic: number): number => {
    if (value < min) return min + (value - min) * Math.max(0, Math.min(1, elastic))
    if (value > max) return max + (value - max) * Math.max(0, Math.min(1, elastic))
    return value
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/**
 * Attach a drag gesture to an element.
 *
 * Captures the pointer, updates x/y transforms with axis and optional direction lock,
 * applies elastic overflow against constraints, emits lifecycle callbacks with DragInfo,
 * and runs a momentum animation on release when enabled.
 */
export const attachDrag = (el: HTMLElement, opts: AttachDragOptions): (() => void) => {
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

    const setXY = (x: number, y: number) => {
        const payload: Record<string, unknown> = {}
        if (axis === true || axis === 'x') payload.x = x
        if (axis === true || axis === 'y') payload.y = y
        // duration: 0 to write instantly via Motion
        animate(el, payload as DOMKeyframesDefinition, { duration: 0 })
        // Track applied transform for correct subsequent drag origins
        if ('x' in payload) applied.x = x
        if ('y' in payload) applied.y = y

        // Verify it's actually applied
        const cs = getComputedStyle(el)
        const actualTransform = cs.transform
        if (actualTransform === 'none' || !actualTransform.includes('matrix')) {
            console.warn('⚠️ setXY called but no transform applied!', {
                x,
                y,
                transform: actualTransform
            })
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

    const beginDrag = (e: PointerEvent, snapToCursor = false) => {
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

        constraints = resolveConstraints(el, opts.constraints)

        dragging = true
        lockAxis = null
        lastT = now()
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

        lastT = t
        lastPoint = { x: nx, y: ny }

        const dx = nx - startPoint.x
        const dy = ny - startPoint.y

        // Direction lock
        if (directionLock && !lockAxis && Math.hypot(dx, dy) >= lockThreshold) {
            lockAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
            opts.callbacks?.onDirectionLock?.(lockAxis)
        }

        const applyX = axis === true || axis === 'x'
        const applyY = axis === true || axis === 'y'

        let x = origin.x + (applyX ? dx : 0)
        let y = origin.y + (applyY ? dy : 0)

        // Respect direction lock
        if (lockAxis === 'x') y = origin.y
        if (lockAxis === 'y') x = origin.x

        // Convert to relative translation by clamping within constraints
        if (constraints) {
            const minX = origin.x + (constraints.left ?? -Infinity)
            const maxX = origin.x + (constraints.right ?? Infinity)
            const minY = origin.y + (constraints.top ?? -Infinity)
            const maxY = origin.y + (constraints.bottom ?? Infinity)
            x = applyElastic(x, minX, maxX, elastic)
            y = applyElastic(y, minY, maxY, elastic)
        }

        // Apply absolute transform in element space
        setXY(x, y)
        opts.callbacks?.onMove?.(e, computeInfo())
    }

    const onPointerUp = (e: PointerEvent) => {
        if (!dragging) return
        finishDrag(e)
    }
    const onPointerCancel = (e: PointerEvent) => {
        if (!dragging) return
        finishDrag(e)
    }

    const finishDrag = (e: PointerEvent) => {
        dragging = false
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

        // Momentum/inertia: exponential decay towards ideal target (clamped to constraints)
        if (momentum) {
            console.log('🚀 STARTING MOMENTUM', {
                velocityX: velocity.x,
                velocityY: velocity.y,
                appliedX: applied.x,
                appliedY: applied.y,
                historyLength: history.length,
                historyFirst: history[0],
                historyLast: history[history.length - 1]
            })
            const minX = origin.x + (constraints?.left ?? -Infinity)
            const maxX = origin.x + (constraints?.right ?? Infinity)
            const minY = origin.y + (constraints?.top ?? -Infinity)
            const maxY = origin.y + (constraints?.bottom ?? Infinity)

            const timeConstantMs = (opts.transition?.timeConstant ?? 0.75) * 1000
            const restDelta = (opts.transition as unknown as { restDelta?: number })?.restDelta ?? 1
            const restSpeed =
                (opts.transition as unknown as { restSpeed?: number })?.restSpeed ?? 10

            // Compute inertia amplitude with power scaling (React uses 0.8)
            const power = 0.8
            const amplitudeX = power * velocity.x * (timeConstantMs / 1000)
            const amplitudeY = power * velocity.y * (timeConstantMs / 1000)
            const idealX = applied.x + amplitudeX
            const idealY = applied.y + amplitudeY

            // Clamp to constraints or snap to origin
            const targetX = opts.snapToOrigin ? 0 : Math.max(minX, Math.min(maxX, idealX))
            const targetY = opts.snapToOrigin ? 0 : Math.max(minY, Math.min(maxY, idealY))

            console.log('🎯 TARGET', {
                targetX,
                targetY,
                amplitudeX,
                amplitudeY,
                timeConstantMs,
                restSpeed,
                restDelta
            })

            let running = true
            const startTs = now()
            const startX = applied.x
            const startY = applied.y
            let frameCount = 0

            const raf = () => {
                if (!running) {
                    console.log('🛑 RAF stopped (running = false)')
                    return
                }
                const t = now() - startTs
                frameCount++

                // Exponential decay towards target
                const calcDelta = (amp: number) => -amp * Math.exp(-t / timeConstantMs)
                const px = targetX + calcDelta(targetX - startX)
                const py = targetY + calcDelta(targetY - startY)

                setXY(px, py)

                // Check rest conditions
                const distX = Math.abs(px - targetX)
                const distY = Math.abs(py - targetY)
                const speed = Math.hypot(
                    Math.abs(calcDelta(targetX - startX) * (1000 / timeConstantMs)),
                    Math.abs(calcDelta(targetY - startY) * (1000 / timeConstantMs))
                )

                if (frameCount <= 3 || frameCount % 10 === 0) {
                    console.log(`🔄 FRAME ${frameCount}`, {
                        t: t.toFixed(0),
                        px: px.toFixed(2),
                        py: py.toFixed(2),
                        distX: distX.toFixed(2),
                        distY: distY.toFixed(2),
                        speed: speed.toFixed(2)
                    })
                }

                if (speed < restSpeed && distX < restDelta && distY < restDelta) {
                    console.log('✅ REST REACHED', { frameCount, finalX: targetX, finalY: targetY })
                    setXY(targetX, targetY)
                    running = false
                    stopInertia = null
                    opts.callbacks?.onTransitionEnd?.()
                    return
                }
                requestAnimationFrame(raf)
            }

            stopInertia = () => {
                console.log('❌ MOMENTUM CANCELLED')
                running = false
                stopInertia = null
            }

            console.log('🏁 QUEUING RAF')
            requestAnimationFrame(raf)
        } else {
            console.log('⏸️ MOMENTUM DISABLED')
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
    }

    el.addEventListener('pointerdown', onPointerDown)

    return () => {
        el.removeEventListener('pointerdown', onPointerDown)
        el.removeEventListener('pointermove', onPointerMove as EventListener)
        el.removeEventListener('pointerup', onPointerUp as EventListener)
        el.removeEventListener('pointercancel', onPointerCancel as EventListener)
        window.removeEventListener('pointermove', onPointerMove as EventListener)
        window.removeEventListener('pointerup', onPointerUp as EventListener)
        window.removeEventListener('pointercancel', onPointerCancel as EventListener)
    }
}
