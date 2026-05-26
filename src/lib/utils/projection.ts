/**
 * Projection layout system — minimal foundation for cross-element layout
 * coordination during gestures (drag, layoutId, future shared-element).
 *
 * Direct port of the surface area framer-motion's projection system
 * exposes to consumers, slimmed down to what we actually need for the
 * acceptance criteria of #379:
 *
 * - Per-element `ProjectionNode`s with parent/child wiring through the
 *   Svelte component tree (via `projection.context.ts`).
 * - `willUpdate()` / `didUpdate()` lifecycle around layout-mutating
 *   operations: caller snapshots before the mutation, re-measures
 *   after, fan-outs a `didUpdate` event with the computed delta.
 * - Transform-stripping `measure()` — the load-bearing read primitive.
 *   A child's `getBoundingClientRect()` is contaminated by every
 *   ancestor's transform, so while measuring we temporarily reset the
 *   whole ancestor chain to each node's mount-time `baseTransform`,
 *   then restore in reverse order. Resetting to the captured base
 *   (rather than `'none'`) strips the motion-applied portion of each
 *   transform while preserving the user-authored one — mirroring
 *   framer-motion's `removeBoxTransforms`, which only subtracts
 *   motion-tracked `latestValues`. Generalises what
 *   `layout.ts:measureRect` does for the single-element case across
 *   the projection chain.
 *
 * Math helpers (`createBox`, `createDelta`, `calcBoxDelta`,
 * `isDeltaZero`) are imported directly from `motion-dom` — no need to
 * re-port what upstream already re-exports.
 *
 * KNOWN_LIMITATIONS (deferred to follow-up PRs, see #379):
 * - No depth-sorted FlatTree / `path` array. We walk via `parent`
 *   pointers from leaves; siblings under one parent is sufficient for
 *   the Reorder use case and the rest of the projection tree workflows
 *   this PR enables.
 * - No 4-phase tree walk (propagateDirty → resolveTarget →
 *   calcProjection → cleanDirty). Projection-transform *inheritance*
 *   (parent target deltas affecting child positioning) is not implemented
 *   yet. The ancestor-zeroing measure is independent of this — it's a
 *   read-time concern, not a projection-compose concern.
 * - No scale-correction utilities (border-radius / box-shadow). Visual
 *   polish; defer.
 * - No `relativeTarget` / `projectionDelta` with transform inheritance.
 *   Only matters for full shared-element morphing through nested
 *   transforms; current `layoutId.ts` registry handles the simple case.
 * - No `layoutId` registry migration onto projection nodes. The
 *   one-shot pattern in `layoutId.ts` keeps working; future PR can
 *   route through projection nodes for richer coordination.
 */
import { measureRect } from '$lib/utils/layout'
import { calcBoxDelta, createDelta, isDeltaZero } from 'motion-dom'

/**
 * Local mirrors of `motion-utils`'s `Axis` / `Box` / `AxisDelta` /
 * `Delta` types. Inlined because `motion-utils` is a runtime-only
 * transitive dep through `motion-dom` — the runtime helpers
 * (`calcBoxDelta`, `createDelta`, `isDeltaZero`) are re-exported, but
 * the type aliases are not. Same approach we use in
 * `src/lib/components/Reorder/context.ts`.
 *
 * Values match upstream byte-for-byte so handoff between our types and
 * the runtime helpers from motion-dom is implicit.
 */
export interface Axis {
    min: number
    max: number
}
export interface Box {
    x: Axis
    y: Axis
}
export interface AxisDelta {
    translate: number
    scale: number
    origin: number
    originPoint: number
}
export interface Delta {
    x: AxisDelta
    y: AxisDelta
}

/**
 * Event names the projection node fans out. Mirrors framer-motion's
 * `LayoutEvents` subset that's actually consumed externally.
 *
 * - `willUpdate` — fires inside `willUpdate()`, AFTER the pre-mutation
 *   snapshot has been captured. Receives the snapshot Box.
 * - `didUpdate` — fires inside `didUpdate()`, AFTER the post-mutation
 *   re-measure. Receives the full `LayoutUpdateData` payload (layout,
 *   snapshot, delta, hasLayoutChanged).
 * - `measure` — fires every time `measure()` returns a non-null Box.
 *   Useful for debug overlays and follow-up event consumers.
 */
export type ProjectionEventName = 'willUpdate' | 'didUpdate' | 'measure'

/**
 * Payload delivered to `didUpdate` listeners.
 *
 * `layout` is the post-mutation measurement; `snapshot` is the
 * pre-mutation one. `delta` is `calcBoxDelta(snapshot, layout)` and is
 * the value drag-listeners apply via `originPoint += delta.translate`
 * + `motionValue.set(motionValue.get() + delta.translate)` to keep a
 * dragged element under the cursor while its slot moves.
 *
 * `hasLayoutChanged` is `!isDeltaZero(delta)` — uses the upstream
 * rounding threshold so sub-pixel jiggle from constraint-clamped
 * drags doesn't cascade as false-positive layout changes.
 */
export interface ProjectionDidUpdateData {
    layout: Box
    snapshot: Box
    delta: Delta
    hasLayoutChanged: boolean
}

type Listener<E extends ProjectionEventName> = E extends 'didUpdate'
    ? (data: ProjectionDidUpdateData) => void
    : E extends 'willUpdate'
      ? (snapshot: Box) => void
      : (layout: Box) => void

/**
 * Options passed at `ProjectionNode` construction time. All optional —
 * a node with no options still works as a leaf measurement target.
 */
export interface ProjectionNodeOptions {
    /**
     * Parent node in the projection tree. Wire-up is callsite-driven
     * (the consumer reads `getProjectionParent()` from the Svelte
     * context system and passes the result here); the node stores it
     * as `this.parent` and registers self in `parent.children` on
     * `mount()`.
     */
    parent?: ProjectionNode | null
    /**
     * Thunk returning the `layoutScroll` ancestor chain at measure
     * time. Used as the second argument to `measureRect`, which
     * shifts the returned rect by the sum of ancestor
     * `scrollLeft`/`scrollTop` so FLIP deltas stay correct when
     * scrollable ancestors scroll between two measurements.
     *
     * Returning `[]` (or omitting the option entirely) gives
     * viewport-relative measurements — fine for the common case.
     */
    getScrollContainers?: () => HTMLElement[]
}

/**
 * Convert a `DOMRect` to our `Box` shape. Inline because `motion-dom`'s
 * `convertBoundingBoxToBox` works on a BoundingBox (already-derived
 * `top`/`bottom`/`left`/`right`) rather than the DOMRect we get from
 * `getBoundingClientRect`. Same math, just one less indirection.
 */
const rectToBox = (rect: DOMRect): Box => ({
    x: { min: rect.left, max: rect.right },
    y: { min: rect.top, max: rect.bottom }
})

/** Deep-copy a Box so subsequent measurements don't mutate snapshots. */
const cloneBox = (box: Box): Box => ({
    x: { min: box.x.min, max: box.x.max },
    y: { min: box.y.min, max: box.y.max }
})

/**
 * Per-element node in the projection tree. Created at component setup
 * time in `_MotionContainer.svelte`, mounted when the element ref
 * binds, unmounted on cleanup.
 *
 * Lifecycle:
 * 1. `new ProjectionNode({ parent, getScrollContainers })` at setup.
 * 2. `node.mount(element)` once the element ref binds.
 * 3. `node.willUpdate()` before any layout-mutating state change (e.g.
 *    a `values` reassign that reorders DOM children).
 * 4. State mutates → Svelte commits the DOM update.
 * 5. `node.didUpdate()` after the DOM update is flushed — fires
 *    `didUpdate` listeners with the snapshot→current delta.
 * 6. `node.unmount()` on cleanup.
 */
export class ProjectionNode {
    /** The mounted element. `null` until `mount()` runs. */
    element: HTMLElement | null = null
    /**
     * Parent node in the projection tree. Captured at construction
     * from the Svelte context. Set to `null` for root-level motion
     * elements that have no motion ancestor.
     */
    parent: ProjectionNode | null = null
    /**
     * Descendant nodes registered via `mount()`. Iterated when we
     * need to broadcast to the subtree (none in this PR; reserved
     * for follow-up work).
     */
    readonly children: Set<ProjectionNode> = new Set()
    /** Most-recent post-mutation measurement, or `null` before first measure. */
    latestLayout: Box | null = null
    /**
     * Pre-mutation snapshot captured by `willUpdate`. Cleared by
     * `didUpdate` after the delta has been computed. Idempotent for
     * repeat `willUpdate` calls in the same frame — only the first
     * snapshots; subsequent calls no-op so a parent broadcasting
     * `willUpdate` to its children doesn't clobber a child's own
     * earlier snapshot.
     */
    snapshot: Box | null = null
    /** Whether `mount()` has been called and `unmount()` has not. */
    isMounted = false
    /**
     * The element's `style.transform` captured at `mount()` time — the
     * user-authored base. Motion only ever writes a transform to the
     * element AFTER mount (FLIP fires on a layout change, drag on
     * pointerdown), so whatever is present at mount is the user's own
     * styling transform and nothing else.
     *
     * `measure()` restores ancestors (and self, via `measureRect`) to
     * this base rather than to `'none'`. That removes exactly the
     * motion-applied portion of the transform while leaving the
     * user-authored part intact — the same distinction framer-motion
     * draws by only subtracting motion-tracked `latestValues` in
     * `removeBoxTransforms` and skipping nodes with no tracked
     * transform. A purely static user transform therefore stays in the
     * measured layout box (matching upstream); a FLIP/drag transform
     * written after mount is stripped.
     */
    baseTransform = ''

    private readonly listeners: Map<ProjectionEventName, Set<(...args: unknown[]) => void>> =
        new Map()
    private readonly getScrollContainers: (() => HTMLElement[]) | undefined

    constructor(options: ProjectionNodeOptions = {}) {
        this.parent = options.parent ?? null
        this.getScrollContainers = options.getScrollContainers
    }

    /**
     * Register this node with its parent + bind to a DOM element.
     * Idempotent — calling `mount()` twice on the same element is a
     * no-op for the registration steps.
     *
     * @param element The DOM element this node represents.
     */
    mount(element: HTMLElement): void {
        if (this.isMounted && this.element === element) return
        if (this.isMounted) this.unmount()
        this.element = element
        // Capture the user-authored transform before motion ever writes
        // one. See `baseTransform` for why mount-time is the right moment.
        this.baseTransform = element.style.transform
        this.isMounted = true
        this.parent?.children.add(this)
    }

    /**
     * Tear down. Detaches from parent, clears children references,
     * drops all listeners. Safe to call on a never-mounted node and
     * safe to call twice.
     */
    unmount(): void {
        if (!this.isMounted) return
        this.parent?.children.delete(this)
        this.children.clear()
        this.listeners.clear()
        this.element = null
        this.latestLayout = null
        this.snapshot = null
        this.baseTransform = ''
        this.isMounted = false
    }

    /**
     * Read the element's layout box with every ancestor's
     * motion-applied transform temporarily removed, while preserving
     * each ancestor's user-authored base transform.
     *
     * Mechanism:
     * 1. Walk `this.parent` chain bottom-up, collecting every
     *    mounted ancestor node (excludes self — `measureRect`
     *    handles self's transform internally).
     * 2. Snapshot each ancestor's current `el.style.transform`.
     * 3. Set each to its node's `baseTransform` (the user-authored
     *    value captured at mount). This strips any FLIP/drag transform
     *    written after mount while keeping the user's static one — see
     *    `baseTransform`.
     * 4. Delegate to `measureRect(self.element, scrollContainers,
     *    self.baseTransform)`, which applies self's base transform
     *    inside its own try/finally and returns the scroll-compensated
     *    DOMRect.
     * 5. Restore ancestor transforms in reverse order inside a
     *    `finally` block — guarantees restoration even if measure
     *    throws.
     * 6. Convert DOMRect → Box and cache as `latestLayout`.
     *
     * Returns `null` when `element` is not mounted.
     */
    measure(): Box | null {
        if (!this.element) return null

        // Collect ancestor nodes bottom-up. Skips ancestors that
        // haven't bound yet (`element === null`).
        const ancestors: ProjectionNode[] = []
        let cursor: ProjectionNode | null = this.parent
        while (cursor) {
            if (cursor.element) ancestors.push(cursor)
            cursor = cursor.parent
        }

        // Snapshot current transform; reset each ancestor to its
        // user-authored base for the duration of the measure.
        const restoreList: Array<{ el: HTMLElement; prev: string; base: string }> = ancestors.map(
            (node) => ({
                el: node.element!,
                prev: node.element!.style.transform,
                base: node.baseTransform
            })
        )
        try {
            for (const { el, base } of restoreList) el.style.transform = base
            // measureRect applies self's base transform + scroll-container offset.
            const rect = measureRect(
                this.element,
                this.getScrollContainers?.() ?? [],
                this.baseTransform
            )
            const box = rectToBox(rect)
            this.latestLayout = box
            this.notify('measure', box)
            return box
        } finally {
            // Reverse-order restore — important because ancestor
            // composition cascades from outer-most down; restoring
            // bottom-up matches the snapshot order.
            for (let i = restoreList.length - 1; i >= 0; i--) {
                restoreList[i].el.style.transform = restoreList[i].prev
            }
        }
    }

    /**
     * Snapshot the current layout box for use by the next
     * `didUpdate()`. Caller's contract: invoke this BEFORE the
     * layout-mutating state change so the snapshot reflects the
     * pre-mutation position.
     *
     * Idempotent within a frame — once a snapshot exists, subsequent
     * `willUpdate()` calls are no-ops until `didUpdate()` consumes it.
     * This means a parent that broadcasts `willUpdate` to its
     * children before its own snapshot is fine: children snapshot
     * themselves first via their own willUpdate, parent's broadcast
     * is a no-op.
     */
    willUpdate(): void {
        if (!this.element || this.snapshot) return
        const measured = this.measure()
        if (!measured) return
        this.snapshot = cloneBox(measured)
        this.notify('willUpdate', this.snapshot)
    }

    /**
     * Re-measure post-mutation, compute the delta against the
     * snapshot, fire `didUpdate` listeners. No-op when there's no
     * snapshot (matches upstream — `willUpdate` MUST precede
     * `didUpdate` for the cycle to fire).
     *
     * Always clears the snapshot at the end so the next gesture's
     * `willUpdate`/`didUpdate` cycle starts fresh.
     */
    didUpdate(): void {
        if (!this.element || !this.snapshot) {
            this.snapshot = null
            return
        }
        const layout = this.measure()
        if (!layout) {
            this.snapshot = null
            return
        }
        const delta = createDelta()
        calcBoxDelta(delta, this.snapshot, layout)
        const hasLayoutChanged = !isDeltaZero(delta)
        const payload: ProjectionDidUpdateData = {
            layout,
            snapshot: this.snapshot,
            delta,
            hasLayoutChanged
        }
        this.snapshot = null
        this.notify('didUpdate', payload)
    }

    /**
     * Observer-driven layout-change commit. Unlike the explicit
     * `willUpdate()` → mutate → `didUpdate()` cycle (used when a
     * consumer controls the exact mutation moment, e.g. Reorder.Group
     * before a `values` reassign), this is for the reactive path where
     * a layout change has ALREADY happened and we only learn about it
     * after the fact (the existing `observeLayoutChanges` FLIP loop in
     * `_MotionContainer`).
     *
     * Uses the cached `latestLayout` (the pre-change position from
     * mount or the previous commit) as the snapshot, re-measures the
     * post-change position, and fires `didUpdate` with the delta.
     *
     * First call after mount just seeds `latestLayout` (no prior
     * position to diff against) and fires nothing.
     *
     * Crucially this is gated on a non-zero delta. The FLIP animation
     * this commit runs alongside writes its own inverse `transform` to
     * the element every frame, and those writes re-trigger the same
     * `observeLayoutChanges` signal that drives this method. Those
     * re-fires carry no real layout change (the ancestor-zeroed measure
     * is identical to the previous one), so without the `isDeltaZero`
     * gate every animation frame would fan out a `delta: 0` event and
     * clobber the genuine delta from the originating change.
     */
    commitLayoutChange(): void {
        if (!this.element) return
        const previous = this.latestLayout
        const layout = this.measure()
        if (!layout) return
        if (!previous) return // first call after mount: seed only, nothing to diff
        const delta = createDelta()
        calcBoxDelta(delta, previous, layout)
        if (isDeltaZero(delta)) return // observer re-fired on our own FLIP transform write
        this.notify('didUpdate', {
            layout,
            snapshot: previous,
            delta,
            hasLayoutChanged: true
        })
    }

    /**
     * Subscribe to a projection event. Returns an unsubscribe
     * function. Safe to call after `unmount()` (becomes a no-op).
     */
    addEventListener<E extends ProjectionEventName>(name: E, cb: Listener<E>): () => void {
        let bucket = this.listeners.get(name)
        if (!bucket) {
            bucket = new Set()
            this.listeners.set(name, bucket)
        }
        const wrapped = cb as (...args: unknown[]) => void
        bucket.add(wrapped)
        return () => {
            this.listeners.get(name)?.delete(wrapped)
        }
    }

    private notify(name: 'willUpdate', payload: Box): void
    private notify(name: 'didUpdate', payload: ProjectionDidUpdateData): void
    private notify(name: 'measure', payload: Box): void
    private notify(name: ProjectionEventName, payload: unknown): void {
        const bucket = this.listeners.get(name)
        if (!bucket || bucket.size === 0) return
        // Snapshot the bucket so unsubscribes inside a listener don't
        // skip the next listener in the iteration.
        for (const cb of [...bucket]) cb(payload)
    }
}
