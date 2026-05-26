/**
 * Pan gesture session.
 *
 * Direct port of framer-motion's `PanSession`
 * (`packages/framer-motion/src/gestures/pan/PanSession.ts`) and `PanGesture`
 * (`packages/framer-motion/src/gestures/pan/index.ts`). Pan is the
 * primitive that powers swipe-to-dismiss drawers, swipe-to-delete rows,
 * carousels, and any gesture that tracks pointer offset/velocity without
 * the constraint/momentum/snap-to-origin baggage of `drag`.
 *
 * Critical design notes (mirrors upstream):
 *
 * - `pointermove`, `pointerup`, `pointercancel` subscribe on the
 *   `contextWindow` (defaults to `window`), NOT the source element. This
 *   keeps the gesture alive even when the pointer leaves the element's
 *   bounds during a fast swipe — the original element is only used for
 *   the initial `pointerdown` and for scroll-compensation tracking.
 *
 * - `distanceThreshold` (default `3`px) gates the `onStart` callback so
 *   a steady press without movement doesn't fire a pan. `onSessionStart`
 *   fires immediately on pointerdown for setup work.
 *
 * - Per-frame throttling via `frame.update(updatePoint, true)` so a flood
 *   of pointermove events doesn't run handlers more than once per render
 *   frame. On top of that, individual handlers are routed onto motion-dom's
 *   step lanes (see `wrapUpdate` / `wrapPostRender` above):
 *   `onSessionStart` / `onStart` / `onMove` land on `update`,
 *   `onEnd` / `onSessionEnd` on `postRender`. Matches upstream's
 *   `asyncHandler` + `frame.postRender` split byte-for-byte.
 *
 * - `getPanInfo` returns `{ point, delta, offset, velocity }` — identical
 *   shape to motion-dom's `DragInfo` / framer-motion's `PanInfo`.
 *
 * - Velocity uses a 100ms history window with the "skip the pointer-down
 *   origin if it's too stale" tweak upstream added for hold-then-flick
 *   gestures.
 */
import type { DragInfo } from '$lib/types'
import { cancelFrame, frame, frameData, isPrimaryPointer } from 'motion-dom'

/**
 * Per-handler frame-loop scheduling, mirroring upstream's `asyncHandler` /
 * `frame.postRender` split in
 * `motion/packages/framer-motion/src/gestures/pan/index.ts`.
 *
 * motion-dom's frame loop runs in fixed order each tick:
 * `setup → read → resolveKeyframes → preUpdate → update → preRender →
 *  render → postRender`. Upstream routes:
 *
 * - `onSessionStart` / `onStart` / `onMove` through `frame.update(fn, false, true)`
 *   so handler work co-schedules with the same frame's animation `update`
 *   pass — any `animate(...)` kicked off from a handler lands in the same
 *   tick as the gesture sample that triggered it.
 *
 * - `onEnd` (and our extension `onSessionEnd`) through `frame.postRender(fn)`
 *   so consumer state mutations that close the gesture (`open = false`,
 *   `deck = deck.slice(1)`, etc.) commit AFTER the current frame's render
 *   finishes. The next frame opens fresh without the gesture state
 *   straddling the render boundary.
 *
 * Both wrappers are undefined-safe: passing `undefined` returns
 * `undefined`, so the session can keep its existing presence-check pattern.
 */
type WrappableHandler = ((event: PointerEvent, info: DragInfo) => void) | undefined
const wrapUpdate = (handler: WrappableHandler): WrappableHandler => {
    if (!handler) return undefined
    return (event, info) => {
        frame.update(() => handler(event, info), false, true)
    }
}
const wrapPostRender = (handler: WrappableHandler): WrappableHandler => {
    if (!handler) return undefined
    return (event, info) => {
        frame.postRender(() => handler(event, info))
    }
}
const wrapHandlers = (handlers: PanHandlers): PanHandlers => ({
    onSessionStart: wrapUpdate(handlers.onSessionStart),
    onStart: wrapUpdate(handlers.onStart),
    onMove: wrapUpdate(handlers.onMove),
    onEnd: wrapPostRender(handlers.onEnd),
    onSessionEnd: wrapPostRender(handlers.onSessionEnd)
})

type Point = { x: number; y: number }
type TimestampedPoint = Point & { timestamp: number }

const overflowStyles = new Set(['auto', 'scroll'])

const millisecondsToSeconds = (ms: number): number => ms / 1000
const secondsToMilliseconds = (s: number): number => s * 1000

const subtractPoint = (a: Point, b: Point): Point => ({
    x: a.x - b.x,
    y: a.y - b.y
})

const distance2D = (a: Point, b: Point): number => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)

/**
 * Compute velocity (px/s) from the history of timestamped points,
 * looking back `timeDelta` seconds for stability. Matches upstream's
 * `getVelocity` including the hold-then-flick safeguard (skip
 * history[0] if it's > 2× timeDelta old AND there are alternatives).
 */
const getVelocity = (history: TimestampedPoint[], timeDelta: number): Point => {
    if (history.length < 2) return { x: 0, y: 0 }

    let i = history.length - 1
    let timestampedPoint: TimestampedPoint | null = null
    const lastPoint = history[history.length - 1]
    while (i >= 0) {
        timestampedPoint = history[i]
        if (lastPoint.timestamp - timestampedPoint.timestamp > secondsToMilliseconds(timeDelta)) {
            break
        }
        i--
    }
    if (!timestampedPoint) return { x: 0, y: 0 }

    if (
        timestampedPoint === history[0] &&
        history.length > 2 &&
        lastPoint.timestamp - timestampedPoint.timestamp > secondsToMilliseconds(timeDelta) * 2
    ) {
        timestampedPoint = history[1]
    }

    const time = millisecondsToSeconds(lastPoint.timestamp - timestampedPoint.timestamp)
    if (time === 0) return { x: 0, y: 0 }

    const v: Point = {
        x: (lastPoint.x - timestampedPoint.x) / time,
        y: (lastPoint.y - timestampedPoint.y) / time
    }
    if (v.x === Infinity) v.x = 0
    if (v.y === Infinity) v.y = 0
    return v
}

const getPanInfo = (point: Point, history: TimestampedPoint[]): DragInfo => ({
    point,
    delta: subtractPoint(point, history[history.length - 1]),
    offset: subtractPoint(point, history[0]),
    velocity: getVelocity(history, 0.1)
})

const extractEventPoint = (event: PointerEvent): Point => ({
    x: event.pageX,
    y: event.pageY
})

export interface PanHandlers {
    /** Fires on `pointerdown` regardless of whether movement follows. */
    onSessionStart?: (event: PointerEvent, info: DragInfo) => void
    /** Fires the first time pointer offset crosses `distanceThreshold`. */
    onStart?: (event: PointerEvent, info: DragInfo) => void
    /** Fires on every per-frame-throttled pointermove past threshold. */
    onMove?: (event: PointerEvent, info: DragInfo) => void
    /** Fires on `pointerup` / `pointercancel` if `onStart` ever fired. */
    onEnd?: (event: PointerEvent, info: DragInfo) => void
    /** Fires on `pointerup` / `pointercancel` always (paired with `onSessionStart`). */
    onSessionEnd?: (event: PointerEvent, info: DragInfo) => void
}

export interface AttachPanOptions {
    /**
     * Movement distance (in pixels) required before `onStart`/`onMove`
     * fire. Default `3` — same as framer-motion. A steady press with
     * sub-threshold drift is reported via `onSessionStart` / `onSessionEnd`
     * only.
     */
    distanceThreshold?: number
    /**
     * Window to attach the move/up/cancel listeners to. Defaults to the
     * source element's owner window. Override for iframe / shadow-root
     * scenarios.
     */
    contextWindow?: Window | null
}

/**
 * Attach a pan gesture session to `el`. Returns a cleanup function that
 * tears down the pointerdown listener and ends any in-flight session.
 *
 * Internally a fresh `PanSession` spawns on each pointerdown — the
 * outer attachment just keeps the pointerdown listener alive across the
 * element's lifetime.
 */
export const attachPan = (
    el: HTMLElement,
    handlers: PanHandlers,
    options: AttachPanOptions = {}
): (() => void) => {
    const contextWindow = options.contextWindow ?? el.ownerDocument?.defaultView ?? window
    const distanceThreshold = options.distanceThreshold ?? 3

    let session: PanSession | null = null

    // Frame-scheduled mirror of the live handlers — onSessionStart / onStart /
    // onMove are queued onto motion-dom's `update` step, onEnd / onSessionEnd
    // onto `postRender`. This is the wrap upstream applies via `asyncHandler`
    // + `frame.postRender` in PanGesture.createPanHandlers; see the
    // wrapUpdate / wrapPostRender helpers at the top of this file for the
    // rationale. PanSession itself stays scheduler-unaware (and synchronous,
    // for testability) — the scheduling lives at the `attachPan` boundary.
    let liveHandlers = wrapHandlers(handlers)

    const onPointerDown = (event: PointerEvent) => {
        // Match upstream: ignore non-primary pointers (multi-touch, right-click).
        if (!isPrimaryPointer(event)) return
        session = new PanSession(event, liveHandlers, {
            distanceThreshold,
            contextWindow,
            element: el
        })
    }

    el.addEventListener('pointerdown', onPointerDown)

    const update = (next: PanHandlers): void => {
        liveHandlers = wrapHandlers(next)
        session?.updateHandlers(liveHandlers)
    }

    const teardown = (): void => {
        el.removeEventListener('pointerdown', onPointerDown)
        session?.end()
        session = null
    }

    // Expose updateHandlers on the cleanup fn so the container can refresh
    // callbacks mid-session without tearing down (e.g. when the consumer's
    // onPan changes between renders). Optional — most callers can ignore it.
    ;(teardown as unknown as { update: typeof update }).update = update

    return teardown
}

interface PanSessionInternalOptions {
    distanceThreshold: number
    contextWindow: Window
    element: HTMLElement | null
}

class PanSession {
    private history: TimestampedPoint[] = []
    private startEvent: PointerEvent | null = null
    private lastMoveEvent: PointerEvent | null = null
    private lastMovePoint: Point | null = null
    private handlers: PanHandlers = {}
    private contextWindow: Window = window
    private distanceThreshold = 3
    private element: HTMLElement | null = null
    private scrollPositions = new Map<Element | Window, Point>()
    private removeScrollListeners: (() => void) | null = null
    private removeListeners: (() => void) | null = null

    constructor(event: PointerEvent, handlers: PanHandlers, opts: PanSessionInternalOptions) {
        // Bail on non-primary pointers. Properties keep their declared
        // defaults so TypeScript sees them initialized regardless of which
        // constructor branch ran.
        if (!isPrimaryPointer(event)) return

        this.handlers = handlers
        this.contextWindow = opts.contextWindow
        this.distanceThreshold = opts.distanceThreshold
        this.element = opts.element

        const point = extractEventPoint(event)
        this.history = [{ ...point, timestamp: frameData.timestamp }]

        this.handlers.onSessionStart?.(event, getPanInfo(point, this.history))

        const moveHandler = (e: PointerEvent) => this.handlePointerMove(e)
        const upHandler = (e: PointerEvent) => this.handlePointerUp(e)

        this.contextWindow.addEventListener('pointermove', moveHandler)
        this.contextWindow.addEventListener('pointerup', upHandler)
        this.contextWindow.addEventListener('pointercancel', upHandler)
        this.removeListeners = () => {
            this.contextWindow.removeEventListener('pointermove', moveHandler)
            this.contextWindow.removeEventListener('pointerup', upHandler)
            this.contextWindow.removeEventListener('pointercancel', upHandler)
        }

        if (this.element) this.startScrollTracking(this.element)
    }

    updateHandlers(handlers: PanHandlers): void {
        this.handlers = handlers
    }

    end(): void {
        this.removeListeners?.()
        this.removeListeners = null
        this.removeScrollListeners?.()
        this.removeScrollListeners = null
        this.scrollPositions.clear()
        cancelFrame(this.updatePoint)
    }

    private handlePointerMove = (event: PointerEvent): void => {
        this.lastMoveEvent = event
        this.lastMovePoint = extractEventPoint(event)
        // Per-frame throttle so a 1000hz mouse doesn't drown handlers.
        frame.update(this.updatePoint, true)
    }

    private handlePointerUp = (event: PointerEvent): void => {
        this.end()
        if (!(this.lastMoveEvent && this.lastMovePoint)) {
            // Pointerup before any pointermove — fire session-end with the
            // initial point so consumers see a balanced lifecycle.
            const startPoint = this.history[0]
            const info = getPanInfo(startPoint, this.history)
            this.handlers.onSessionEnd?.(event, info)
            return
        }

        const finalPoint =
            event.type === 'pointercancel' ? this.lastMovePoint : extractEventPoint(event)
        const info = getPanInfo(finalPoint, this.history)

        if (this.startEvent) this.handlers.onEnd?.(event, info)
        this.handlers.onSessionEnd?.(event, info)
    }

    private updatePoint = (): void => {
        if (!(this.lastMoveEvent && this.lastMovePoint)) return

        const info = getPanInfo(this.lastMovePoint, this.history)
        const panAlreadyStarted = this.startEvent !== null
        const pastThreshold = distance2D(info.offset, { x: 0, y: 0 }) >= this.distanceThreshold

        if (!panAlreadyStarted && !pastThreshold) return

        this.history.push({ ...this.lastMovePoint, timestamp: frameData.timestamp })

        if (!panAlreadyStarted) {
            this.handlers.onStart?.(this.lastMoveEvent, info)
            this.startEvent = this.lastMoveEvent
        }
        this.handlers.onMove?.(this.lastMoveEvent, info)
    }

    /**
     * Track scrollable ancestors so we can compensate for scroll deltas
     * during the gesture — mirrors upstream's `startScrollTracking`.
     * For element scrolls: adjust `history[0]` so offset stays sane
     * (pageX/pageY unaffected by element scroll). For window scrolls:
     * adjust `lastMovePoint` (pageX/pageY shift with window scroll).
     */
    private startScrollTracking(element: HTMLElement): void {
        let current: HTMLElement | null = element.parentElement
        while (current) {
            const style = getComputedStyle(current)
            if (overflowStyles.has(style.overflowX) || overflowStyles.has(style.overflowY)) {
                this.scrollPositions.set(current, {
                    x: current.scrollLeft,
                    y: current.scrollTop
                })
            }
            current = current.parentElement
        }
        this.scrollPositions.set(this.contextWindow, {
            x: this.contextWindow.scrollX,
            y: this.contextWindow.scrollY
        })

        const onElementScroll = (event: Event): void => {
            this.handleScroll(event.target as Element)
        }
        const onWindowScroll = (): void => {
            this.handleScroll(this.contextWindow)
        }

        this.contextWindow.addEventListener('scroll', onElementScroll, { capture: true })
        this.contextWindow.addEventListener('scroll', onWindowScroll)

        this.removeScrollListeners = () => {
            this.contextWindow.removeEventListener('scroll', onElementScroll, {
                capture: true
            })
            this.contextWindow.removeEventListener('scroll', onWindowScroll)
        }
    }

    private handleScroll(target: Element | Window): void {
        const initial = this.scrollPositions.get(target)
        if (!initial) return

        const isWindow = target === this.contextWindow
        const current = isWindow
            ? { x: this.contextWindow.scrollX, y: this.contextWindow.scrollY }
            : {
                  x: (target as Element).scrollLeft,
                  y: (target as Element).scrollTop
              }
        const delta = { x: current.x - initial.x, y: current.y - initial.y }
        if (delta.x === 0 && delta.y === 0) return

        if (isWindow) {
            if (this.lastMovePoint) {
                this.lastMovePoint.x += delta.x
                this.lastMovePoint.y += delta.y
            }
        } else if (this.history.length > 0) {
            this.history[0].x -= delta.x
            this.history[0].y -= delta.y
        }

        this.scrollPositions.set(target, current)
        frame.update(this.updatePoint, true)
    }
}
