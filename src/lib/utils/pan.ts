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

/**
 * Brand we stamp on already-wrapped handlers so passing them back through
 * `wrapHandlers` (e.g. by a future middleware layer) doesn't double-defer
 * — that would compound frame latency invisibly per wrap depth. Symbol
 * scoping keeps it private to this module.
 */
const WRAPPED_BRAND = Symbol('svelte-motion:pan:wrapped')
type WrappedHandler = WrappableHandler & { [WRAPPED_BRAND]?: true }

const wrapUpdate = (handler: WrappableHandler, isAlive: () => boolean): WrappableHandler => {
    if (!handler) return undefined
    if ((handler as WrappedHandler)[WRAPPED_BRAND]) return handler
    const wrapped: WrappedHandler = (event, info) => {
        frame.update(
            () => {
                // `isAlive` flips false on teardown; any frame.update closure
                // queued before teardown but not yet flushed will see this and
                // short-circuit — that's our cancellation path for the
                // otherwise-uncancellable anonymous closures `frame.update`
                // accepts.
                if (!isAlive()) return
                handler(event, info)
            },
            false,
            true
        )
    }
    Object.defineProperty(wrapped, WRAPPED_BRAND, { value: true })
    return wrapped
}

const wrapPostRender = (handler: WrappableHandler, isAlive: () => boolean): WrappableHandler => {
    if (!handler) return undefined
    if ((handler as WrappedHandler)[WRAPPED_BRAND]) return handler
    const wrapped: WrappedHandler = (event, info) => {
        frame.postRender(() => {
            if (!isAlive()) return
            handler(event, info)
        })
    }
    Object.defineProperty(wrapped, WRAPPED_BRAND, { value: true })
    return wrapped
}

const wrapHandlers = (handlers: PanHandlers, isAlive: () => boolean): PanHandlers => ({
    onSessionStart: wrapUpdate(handlers.onSessionStart, isAlive),
    onStart: wrapUpdate(handlers.onStart, isAlive),
    onMove: wrapUpdate(handlers.onMove, isAlive),
    onEnd: wrapPostRender(handlers.onEnd, isAlive),
    onSessionEnd: wrapPostRender(handlers.onSessionEnd, isAlive)
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
 * Cleanup function returned by `attachPan`. Carries an `update` method
 * that hot-swaps the live handler set without tearing down the active
 * `PanSession` — call this when a consumer's `onPan` reference changes
 * mid-gesture (the canonical Svelte 5 pattern of inline arrow handlers
 * passes a fresh closure every render). Without this, the host
 * `$effect` would have to teardown + re-attach and the user's in-flight
 * pan would silently die.
 */
export type AttachPanCleanup = (() => void) & {
    update: (next: PanHandlers) => void
}

/**
 * Attach a pan gesture session to `el`. Returns a cleanup function that
 * tears down the pointerdown listener and ends any in-flight session,
 * with a `.update(next)` method for hot-swapping handlers mid-gesture.
 *
 * Internally a fresh `PanSession` spawns on each pointerdown — the
 * outer attachment just keeps the pointerdown listener alive across the
 * element's lifetime.
 *
 * SSR-safe: returns a no-op cleanup if `window` is undefined. The Svelte
 * `$effect` consumer never fires on the server anyway, but defending the
 * boundary lets the module load cleanly in node-only test runners.
 *
 * Lifecycle guarantee: when the returned cleanup runs mid-gesture, the
 * session synthesizes `onEnd` + `onSessionEnd` against the raw handlers
 * BEFORE removing listeners (see `PanSession.dispatchTerminal`). Hosts
 * (e.g. `_MotionContainer`'s pan `$effect`) can put their `whilePan`
 * revert logic inside the user-supplied `onEnd` and rely on it firing
 * exactly once per gesture — whether the user released or the host
 * forced teardown.
 *
 * @param el Target element to bind `pointerdown` on. Move/up/cancel
 *   events are listened for on the element's owning window so a fast
 *   swipe past the element's bounds keeps the gesture alive.
 * @param handlers Pan lifecycle handlers. Any subset of
 *   `onSessionStart` (fires on pointerdown), `onStart` (fires the first
 *   time the cumulative offset crosses `distanceThreshold`), `onMove`
 *   (per-frame-throttled on every pointermove past threshold), `onEnd`
 *   (fires on pointerup/cancel if `onStart` ever fired), `onSessionEnd`
 *   (fires on every pointerup/cancel where a pointermove occurred).
 * @param options Per-session config. `distanceThreshold` (default 3px)
 *   gates the start callback; `contextWindow` overrides the owning
 *   window (use for shadow-root / iframe scenarios).
 * @returns A cleanup function with an attached `.update(next)` method.
 *   Calling the cleanup ends the session + removes the pointerdown
 *   listener. Calling `.update(next)` swaps handlers in place on the
 *   live session without rebuilding it — the canonical Svelte pattern
 *   for inline arrow handlers that change identity each render.
 *
 * @example
 * ```ts
 * const cleanup = attachPan(node, {
 *   onStart: (_event, info) => console.log('start', info.offset),
 *   onMove: (_event, info) => x.set(info.offset.x),
 *   onEnd: (_event, info) => {
 *     if (Math.abs(info.velocity.x) > 600) commit()
 *     else animate(x, 0, { type: 'spring' })
 *   }
 * })
 *
 * // Later, swap handlers without ending the live gesture:
 * cleanup.update({ onMove: (_e, info) => x.set(info.offset.x * 2) })
 *
 * // On unmount:
 * cleanup()
 * ```
 */
export const attachPan = (
    el: HTMLElement,
    handlers: PanHandlers,
    options: AttachPanOptions = {}
): AttachPanCleanup => {
    if (typeof window === 'undefined') {
        const noop = () => {}
        return Object.assign(noop, { update: () => {} })
    }

    const contextWindow = options.contextWindow ?? el.ownerDocument?.defaultView ?? window
    const distanceThreshold = options.distanceThreshold ?? 3

    let session: PanSession | null = null
    let rawHandlers = handlers

    // Liveness flag the wrapped handler closures consult before invoking
    // the user callback. Flips false at teardown so any frame.update /
    // frame.postRender callbacks queued before teardown — but not yet
    // flushed — see the flag and skip dispatch. This is our only way to
    // cancel the anonymous closures the wrappers schedule (frame.update
    // doesn't return a handle we can store per call).
    let isAlive = true
    const aliveGuard = () => isAlive

    // Frame-scheduled mirror of the live handlers — onSessionStart / onStart /
    // onMove are queued onto motion-dom's `update` step, onEnd / onSessionEnd
    // onto `postRender`. This is the wrap upstream applies via `asyncHandler`
    // + `frame.postRender` in PanGesture.createPanHandlers; see the
    // wrapUpdate / wrapPostRender helpers at the top of this file for the
    // rationale. PanSession itself stays scheduler-unaware (and synchronous,
    // for testability) — the scheduling lives at the `attachPan` boundary.
    let liveHandlers = wrapHandlers(handlers, aliveGuard)

    const onPointerDown = (event: PointerEvent) => {
        // Match upstream: ignore non-primary pointers (multi-touch, right-click).
        if (!isPrimaryPointer(event)) return
        // Defensively end any prior session before overwriting the reference.
        // Without this, a second primary pointerdown that arrives before the
        // first pointerup orphans the prior session's contextWindow listeners.
        session?.end()
        session = new PanSession(event, liveHandlers, {
            distanceThreshold,
            contextWindow,
            element: el
        })
    }

    el.addEventListener('pointerdown', onPointerDown)

    const update = (next: PanHandlers): void => {
        rawHandlers = next
        liveHandlers = wrapHandlers(next, aliveGuard)
        session?.updateHandlers(liveHandlers)
    }

    const teardown = (): void => {
        // Synthesize the gesture's terminal lifecycle BEFORE flipping
        // `isAlive`, so a host that tears us down mid-pan (effect re-run,
        // component unmount) still sees a balanced onPanEnd / onPanSessionEnd
        // pair. Dispatched against the *raw* (unwrapped) handlers so the
        // delivery is synchronous — the wrapped lane would otherwise queue
        // the callbacks onto frame.postRender just for them to be cancelled
        // by the `isAlive = false` line immediately below.
        if (session) {
            session.dispatchTerminal(rawHandlers)
            session.end()
            session = null
        }
        isAlive = false
        el.removeEventListener('pointerdown', onPointerDown)
    }

    return Object.assign(teardown, { update })
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
    /**
     * Idempotency flag — set the first time the gesture's terminal
     * lifecycle pair (`onEnd` + `onSessionEnd`) fires. Both
     * `handlePointerUp` (the natural release path) and
     * `dispatchTerminal` (the forced-teardown path called by
     * `attachPan.teardown`) check this and bail if already dispatched.
     * Without it, a normal pointerup followed by a host-side teardown
     * (e.g. `$effect` cleanup, component unmount) would replay
     * `onEnd`/`onSessionEnd` against handlers that already saw them.
     */
    private terminalDispatched = false
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

        // Capture phase so a descendant calling stopPropagation() (e.g.
        // in its own pointerup handler) can't prevent the gesture from
        // ending; passive because the handlers never call
        // preventDefault. Mirrors upstream PanSession (motion#3731).
        const eventOptions: AddEventListenerOptions = { passive: true, capture: true }
        this.contextWindow.addEventListener('pointermove', moveHandler, eventOptions)
        this.contextWindow.addEventListener('pointerup', upHandler, eventOptions)
        this.contextWindow.addEventListener('pointercancel', upHandler, eventOptions)
        this.removeListeners = () => {
            this.contextWindow.removeEventListener('pointermove', moveHandler, eventOptions)
            this.contextWindow.removeEventListener('pointerup', upHandler, eventOptions)
            this.contextWindow.removeEventListener('pointercancel', upHandler, eventOptions)
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

    /**
     * Synthesize the gesture's terminal lifecycle pair (`onEnd` then
     * `onSessionEnd`) against the supplied *raw* (unwrapped) handlers,
     * using the last observed event + point as the synthetic terminal
     * sample. Called by `attachPan.teardown` when a host kills the
     * session mid-gesture — without this, an `$effect` re-run that
     * tears down the attachment silently strands the consumer's state
     * machine in an "in-progress" state (whilePan keyframes never
     * revert, threshold-based commit decisions never run).
     *
     * Bypasses the frame-loop wrappers deliberately: the wrapped
     * handlers would queue to `frame.postRender` only for the
     * about-to-flip `isAlive` flag in attachPan to cancel them. Raw
     * dispatch keeps the lifecycle synchronous with teardown.
     *
     * No-op when no pointermove ever fired — matches the
     * `handlePointerUp` no-movement contract upstream uses.
     */
    dispatchTerminal(rawHandlers: PanHandlers): void {
        if (this.terminalDispatched) return
        if (!(this.lastMoveEvent && this.lastMovePoint)) return
        const info = getPanInfo(this.lastMovePoint, this.history)
        if (this.startEvent) rawHandlers.onEnd?.(this.lastMoveEvent, info)
        rawHandlers.onSessionEnd?.(this.lastMoveEvent, info)
        this.terminalDispatched = true
    }

    private handlePointerMove = (event: PointerEvent): void => {
        this.lastMoveEvent = event
        this.lastMovePoint = extractEventPoint(event)
        // Per-frame throttle so a 1000hz mouse doesn't drown handlers.
        frame.update(this.updatePoint, true)
    }

    private handlePointerUp = (event: PointerEvent): void => {
        this.end()
        if (this.terminalDispatched) return
        if (!(this.lastMoveEvent && this.lastMovePoint)) {
            // No pointermove ever fired — match upstream framer-motion
            // (`packages/framer-motion/src/gestures/pan/PanSession.ts`
            // ~line 320) and return WITHOUT firing onEnd / onSessionEnd.
            // Consumers that want a "tap" signal should use the press /
            // tap gesture instead. This prevents a spurious
            // onPanSessionStart → onPanSessionEnd pair on every plain
            // click of a pan-enabled element.
            return
        }

        const finalPoint =
            event.type === 'pointercancel' ? this.lastMovePoint : extractEventPoint(event)
        const info = getPanInfo(finalPoint, this.history)

        if (this.startEvent) this.handlers.onEnd?.(event, info)
        this.handlers.onSessionEnd?.(event, info)
        // Mark idempotent so a later forced teardown via
        // `dispatchTerminal` doesn't replay this pair.
        this.terminalDispatched = true
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
