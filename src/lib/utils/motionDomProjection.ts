import {
    HTMLProjectionNode,
    HTMLVisualElement,
    copyBoxInto,
    createBox,
    visualElementStore,
    type IProjectionNode,
    type LayoutUpdateData,
    type Measurements,
    type NodeGroup,
    type Phase,
    type ResolvedValues,
    type Transition,
    type VisualElement
} from 'motion-dom'

type ProjectionVisualElement = VisualElement & {
    latestValues: ResolvedValues
    projection?: IProjectionNode<HTMLElement>
}
type ProjectionTreeNode<Instance = unknown> = IProjectionNode<Instance>

type LayoutOption = boolean | string | undefined
type AnimationType = 'position' | 'x' | 'y' | 'size' | 'both' | 'preserve-aspect'
type RectLike = { left: number; top: number; width: number; height: number }

/**
 * Development-only measurement counters.
 *
 * `onProjectionUpdate` / `onLayoutMeasure` counts prove *callback* parity, not
 * *measurement-cost* parity: a `layoutDependency`-gated element that is
 * re-slotted by a sibling still refreshes its cached slot with a silent DOM
 * read. These counters make that hidden cost observable so a demo or test can
 * assert the cadence (one read per observed change, none per unrelated
 * render). Reset them yourself between samples.
 *
 * @example
 * ```ts
 * layoutMeasureStats.reads = 0
 * // ...trigger a keyed reorder...
 * console.log(layoutMeasureStats.reads)
 * ```
 */
export const layoutMeasureStats = {
    /** Page-rect reads that notified `onMeasure` listeners (`measurePageRect`). */
    reads: 0,
    /** Silent cache refreshes for gated elements (`refreshLayout({ silent: true })`). */
    silentReads: 0
}

export interface MotionDomProjectionOptions {
    /** Parent adapter used to connect this node into the upstream projection tree. */
    parent?: MotionDomProjectionAdapter | null
    /**
     * Thunk returning the element's user-authored base transform (e.g. a
     * static `style="transform: …"`). `measurePageRect` resets the element
     * to this value while reading so motion-applied transforms (FLIP /
     * projection animations) never contaminate a layout measurement, while
     * authored transforms stay part of the measured box — mirroring the
     * legacy `ProjectionNode`'s `resolveBaseTransform` contract.
     */
    getBaseTransform?: () => string
    /**
     * The component's own motion-dom VisualElement, when it owns one (#449).
     *
     * `visualElementStore` is a `WeakMap<instance, VisualElement>` populated in
     * `VisualElement.mount()`, so two VisualElements mounted on the same DOM
     * element would overwrite each other in the store and double-render. When
     * `_MotionContainer` owns a VisualElement it must inject it here so this
     * adapter drives the SAME instance rather than constructing a second one.
     */
    visualElement?: ProjectionVisualElement
    /**
     * The nearest `<LayoutGroup>`'s projection node group (plan 007 D3).
     *
     * While mounted with `layout` or `layoutId`, the projection node is a
     * member — upstream `MeasureLayout` adds it in `componentDidMount` and
     * removes it in `componentWillUnmount` — so any member's `willUpdate` or
     * unmount snapshots the other members and they animate together.
     */
    group?: NodeGroup
}

/**
 * Latest layout-related motion props applied to an upstream projection node.
 */
export interface MotionDomProjectionUpdateOptions {
    /** Enables layout projection and selects the upstream animation type. */
    layout?: LayoutOption
    /** Shared layout id used by upstream projection matching. */
    layoutId?: string
    /** Tracks scroll on this element for descendant layout projection. */
    layoutScroll?: boolean
    /** Transition passed to the upstream layout animation builder. */
    transition?: Transition
    /** Inline style props passed through to the visual element. */
    style?: unknown
}

const createVisualState = () => ({
    latestValues: {},
    renderState: {
        transform: {},
        transformOrigin: {},
        style: {},
        vars: {}
    }
})

const cloneMeasurements = (measurements: Measurements | undefined): Measurements | undefined => {
    if (!measurements) return undefined

    const measuredBox = createBox()
    const layoutBox = createBox()
    copyBoxInto(measuredBox, measurements.measuredBox)
    copyBoxInto(layoutBox, measurements.layoutBox)

    return {
        animationId: measurements.animationId,
        measuredBox,
        layoutBox,
        latestValues: { ...measurements.latestValues },
        source: measurements.source
    }
}

/**
 * Convert a page-space rect to the `{ x: {min,max}, y: {min,max} }` box shape
 * upstream motion-dom (and the public `onProjectionUpdate`/`onLayoutMeasure`
 * payloads) use.
 */
export const boxFromRect = (rect: RectLike) => {
    const box = createBox()
    box.x.min = rect.left
    box.x.max = rect.left + rect.width
    box.y.min = rect.top
    box.y.max = rect.top + rect.height
    return box
}

type AxisLike = { min: number; max: number }
const rectFromBox = (box: { x: AxisLike; y: AxisLike }): RectLike => ({
    left: box.x.min,
    top: box.y.min,
    width: box.x.max - box.x.min,
    height: box.y.max - box.y.min
})

const measurementsFromRect = (rect: RectLike, base: Measurements | undefined): Measurements => ({
    animationId: base?.animationId ?? 0,
    measuredBox: boxFromRect(rect),
    layoutBox: boxFromRect(rect),
    latestValues: { ...(base?.latestValues ?? {}) },
    source: base?.source ?? 0
})

const near = (a: number, b: number) => Math.abs(a - b) <= 0.5
const sameSize = (a: RectLike, b: RectLike) => near(a.width, b.width) && near(a.height, b.height)
const rectsMatch = (a: RectLike, b: RectLike) =>
    near(a.left, b.left) && near(a.top, b.top) && sameSize(a, b)

const animationTypes = new Set<AnimationType>([
    'position',
    'x',
    'y',
    'size',
    'both',
    'preserve-aspect'
])

const animationTypeForLayout = (layout: LayoutOption): AnimationType =>
    typeof layout === 'string' && animationTypes.has(layout as AnimationType)
        ? (layout as AnimationType)
        : 'both'

/**
 * Svelte lifecycle adapter for motion-dom's upstream projection node system.
 *
 * The public Svelte API stays unchanged (`layout`, `layoutId`, `transition`).
 * This adapter only translates those props into the same `HTMLProjectionNode`
 * and `HTMLVisualElement` internals Framer Motion uses.
 */
export class MotionDomProjectionAdapter {
    private static adapters = new WeakMap<object, MotionDomProjectionAdapter>()
    /**
     * Adapters currently registered with each node group. `NodeGroup` keeps
     * its members private, and the observer path needs them to fan out
     * CACHED snapshots (see `commitObservedLayoutChange`).
     */
    private static groupMembers = new WeakMap<NodeGroup, Set<MotionDomProjectionAdapter>>()

    readonly visualElement: ProjectionVisualElement
    readonly projection: IProjectionNode<HTMLElement>

    private element: HTMLElement | null = null
    private layout: LayoutOption
    private layoutId: string | undefined
    private transition: Transition | undefined
    private lastLayout: Measurements | undefined
    /** Handle for the pending refreshCachedLayout frame, cancelled on unmount. */
    private refreshRafId: number | null = null
    private readonly getBaseTransform: (() => string) | undefined
    /**
     * False when the VisualElement was injected by the owning component (#449).
     * The owner then holds the props contract, so `updateOptions` must not
     * overwrite `visualElement.props` behind its back.
     */
    private readonly ownsVisualElement: boolean
    private readonly measureListeners = new Set<(rect: RectLike) => void>()
    /** The nearest LayoutGroup's node group, if any. */
    readonly group: NodeGroup | undefined
    /** Whether the projection node is currently registered with `group`. */
    private isGroupMember = false
    private readonly commitListeners = new Set<(rect: RectLike) => void>()
    private offProjectionDidUpdate: (() => void) | null = null
    /** Before/after layout of this node's most recent upstream update pass. */
    private lastUpdate: { previous: RectLike; next: RectLike } | null = null

    constructor(options: MotionDomProjectionOptions = {}) {
        const parent = options.parent ?? null
        this.group = options.group
        this.getBaseTransform = options.getBaseTransform
        this.ownsVisualElement = !options.visualElement
        // Use the component's VisualElement when one is injected (#449); only
        // construct a private one as a fallback (standalone adapter use, e.g.
        // unit tests and SSR-free consumers that own no component VE).
        this.visualElement =
            options.visualElement ??
            new HTMLVisualElement(
                {
                    parent: parent?.visualElement,
                    props: {},
                    presenceContext: null,
                    visualState: createVisualState()
                },
                { allowProjection: true }
            )
        this.projection = new HTMLProjectionNode(
            this.visualElement.latestValues,
            parent?.projection as unknown as IProjectionNode | undefined
        )
        this.visualElement.projection = this.projection
        MotionDomProjectionAdapter.adapters.set(this.projection, this)
    }

    /**
     * Update projection options from current Svelte props.
     *
     * @param options Current layout-related motion props.
     * @returns Nothing.
     *
     * @example
     * ```ts
     * adapter.updateOptions({ layout, layoutId, transition, style })
     * ```
     */
    updateOptions(options: MotionDomProjectionUpdateOptions): void {
        this.layout = options.layout
        this.layoutId = options.layoutId
        this.transition = options.transition

        // An injected VisualElement's props are the owning component's contract
        // (#449), so MERGE rather than replace: a bare `{ transition, style }`
        // write would drop the owner's `animate`/`variants`/`while*`. The
        // `style` write itself is load-bearing and must keep happening — it is
        // what binds the style MotionValues onto the node, mirroring them into
        // `latestValues` for the projection transform math. Preserve the owner's
        // presence context too: exit features register when the node mounts.
        this.visualElement.update(
            {
                ...(this.ownsVisualElement ? {} : this.visualElement.props),
                transition: options.transition,
                style: options.style
            } as never,
            this.ownsVisualElement ? null : this.visualElement.presenceContext
        )
        this.projection.setOptions({
            layout: options.layout,
            layoutId: options.layoutId,
            layoutScroll: options.layoutScroll,
            animationType: animationTypeForLayout(options.layout),
            transition: options.transition,
            visualElement: this.visualElement
        })
        this.syncGroupMembership()
    }

    /**
     * Mount the upstream projection node to an element and seed its layout.
     *
     * @param element Element represented by the current motion component.
     * @returns Nothing.
     *
     * @example
     * ```ts
     * adapter.mount(element)
     * ```
     */
    mount(element: HTMLElement): void {
        if (this.element === element) return
        if (this.element) this.unmount()

        this.element = element
        MotionDomProjectionAdapter.adapters.set(this.projection, this)
        // An injected VisualElement may already be mounted by its owner; a
        // second mount would re-register it in `visualElementStore` and
        // re-bind its motion values. Seeding the layout still has to run.
        if (this.visualElement.current !== element) {
            this.visualElement.mount(element)
        }
        this.seedLayout()
        // Only grouped nodes are re-measured by passes they didn't trigger
        // themselves in a way the observer path must reconcile (plan 007
        // D4); ungrouped nodes keep their pre-LayoutGroup-group behaviour.
        if (this.group) {
            this.offProjectionDidUpdate = this.projection.addEventListener(
                'didUpdate',
                ({ layout, snapshot }: LayoutUpdateData) => {
                    // This node was layout-dirty and re-measured in an
                    // upstream update pass, whoever triggered it (its own
                    // commit, a group sibling's fan-out, a same-group
                    // ancestor's subtree seed): keep the cached snapshot the
                    // observer path fans out (D5) in step.
                    this.lastLayout = cloneMeasurements(this.projection.layout)
                    const rect = rectFromBox(layout)
                    // Descendants in a separate group use this pair to tell
                    // "I only moved because this node did" (D6).
                    this.lastUpdate = { previous: rectFromBox(snapshot.layoutBox), next: rect }
                    this.shiftFollowingDescendants(
                        layout.x.min - snapshot.layoutBox.x.min,
                        layout.y.min - snapshot.layoutBox.y.min
                    )
                    for (const listener of this.commitListeners) listener(rect)
                }
            )
        }
        this.syncGroupMembership()
    }

    /**
     * Unmount the upstream projection node and clear its visual-element store.
     *
     * @returns Nothing.
     *
     * @example
     * ```ts
     * adapter.unmount()
     * ```
     */
    unmount(): void {
        if (!this.element) return
        const element = this.element
        this.projection.scheduleCheckAfterUnmount()
        // Upstream MeasureLayout.componentWillUnmount order: schedule the
        // unmount check, THEN leave the group — `remove` snapshots every
        // remaining member so they can animate into the freed space.
        //
        // Svelte removes the DOM BEFORE effect teardown reaches here, so
        // `remove()`'s live `willUpdate(false)` would snapshot the members'
        // post-removal layout and nothing would animate. Seed them from their
        // cached (pre-removal) layouts first and run the update pass
        // ourselves; `remove()` then skips them as already layout-dirty
        // (plan 007 Step 4b-b).
        if (this.isGroupMember) {
            const root = this.projection.root
            root?.startUpdate()
            if (this.seedCachedSnapshotsForGroup() > 0) root?.didUpdate()
        }
        this.leaveGroup()
        this.offProjectionDidUpdate?.()
        this.offProjectionDidUpdate = null
        this.lastUpdate = null
        // An injected VisualElement may already have been unmounted by its
        // owner; unmounting twice would re-run the projection/feature teardown.
        if (this.visualElement.current) this.visualElement.unmount()
        visualElementStore.delete(element)
        MotionDomProjectionAdapter.adapters.delete(this.projection)
        if (this.refreshRafId !== null && typeof window !== 'undefined') {
            cancelAnimationFrame(this.refreshRafId)
        }
        this.refreshRafId = null
        this.element = null
        this.lastLayout = undefined
    }

    /**
     * Capture the upstream "before" snapshot.
     *
     * @returns Nothing.
     *
     * @example
     * ```ts
     * adapter.willUpdate()
     * ```
     */
    willUpdate(): void {
        // `layoutId`-only nodes snapshot too — upstream mounts MeasureLayout
        // for `layout || layoutId`, and a grouped layoutId node's willUpdate
        // is what fans out to its group (plan 007 Step 4b-c).
        if (!this.element || !(this.layout || this.layoutId)) return
        this.projection.willUpdate()
    }

    /**
     * Commit an upstream layout update after Svelte has patched the DOM.
     *
     * @returns Nothing.
     *
     * @example
     * ```ts
     * adapter.didUpdate()
     * ```
     */
    didUpdate(): void {
        if (!this.element || !(this.layout || this.layoutId)) return
        this.projection.root?.didUpdate()
        this.refreshCachedLayout()
    }

    /**
     * Seed the current layout without animating.
     *
     * @returns Nothing.
     *
     * @example
     * ```ts
     * adapter.seedLayout()
     * ```
     */
    seedLayout(): void {
        if (!this.element) return
        // Fresh 'measure'-phase scroll so the seeded layout pairs its
        // viewport box with a contemporaneous scroll offset (page space).
        this.updatePathScroll('measure')
        this.projection.isLayoutDirty = true
        this.projection.updateLayout()
        this.lastLayout = cloneMeasurements(this.projection.layout)
    }

    /**
     * Seed the current layout AND return its page-space rect in a single DOM
     * read.
     *
     * `measurePageRect()` followed by `seedLayout()` reads the box twice (the
     * second via upstream `updateLayout()`). Callers that need both — the
     * observer bridge's cache refresh — use this instead: it strips motion
     * transforms like `measurePageRect`, runs upstream `updateLayout()` once
     * (which is what installs `projection.layout`), and derives the rect from
     * that measurement.
     *
     * @param options.silent Skip the `onMeasure` listener fan-out. A
     * `layoutDependency`-gated element re-slotted by a sibling refreshes its
     * cache silently: upstream never runs `updateLayout()` for a node it
     * didn't snapshot, so `onLayoutMeasure` must not fire.
     * @returns The freshly seeded page-space rect, or `null` before mount.
     *
     * @example
     * ```ts
     * // One read: projection layout seeded, cache rect returned.
     * const rect = adapter.refreshLayout({ silent: true })
     * ```
     */
    refreshLayout(options?: { silent?: boolean }): RectLike | null {
        if (!this.element) return null
        this.updatePathScroll('measure')
        // Physically strip in-flight FLIP/motion transforms for the read —
        // `updateLayout()` measures with `measure(false)`, which trusts the DOM.
        const restore = this.stripToBaseTransforms()
        try {
            this.projection.isLayoutDirty = true
            this.projection.updateLayout()
        } finally {
            restore()
        }
        this.lastLayout = cloneMeasurements(this.projection.layout)
        const box = this.projection.layout?.layoutBox
        if (!box) return null
        const rect = rectFromBox(box)
        if (options?.silent) {
            layoutMeasureStats.silentReads += 1
        } else {
            layoutMeasureStats.reads += 1
            for (const listener of this.measureListeners) listener(rect)
        }
        return rect
    }

    /**
     * Measure this element's layout rect in scroll-invariant PAGE space via
     * the upstream projection node.
     *
     * Mirrors upstream `measure()`/`measurePageBox()` semantics: the viewport
     * box plus the document root's phase-cached scroll offset, with ancestor
     * `layoutScroll` container offsets folded in (`removeElementScroll`). An
     * element that does not move in page space therefore measures the SAME
     * rect regardless of any viewport or container scroll between two reads —
     * a scroll can never masquerade as a layout delta (#437).
     *
     * Motion-applied transforms (an in-flight FLIP or projection animation)
     * are stripped for the duration of the read by resetting this element and
     * every ancestor adapter's element to their user-authored base transform,
     * matching the legacy `ProjectionNode.measure()` contract; inline styles
     * are restored before returning.
     *
     * @param phase Scroll-cache phase marking which side of a layout update
     * this read belongs to: `'snapshot'` before the DOM patch, `'measure'`
     * after. Mirrors upstream `updateScroll(phase)`; the observer bridge's
     * callbacks mark the phase boundaries.
     * @param options.silent Skip the `onMeasure` listener fan-out. Used for
     * cache-only refreshes that upstream would never surface as a measurement
     * — a `layoutDependency`-gated node re-slotted by a sibling never runs
     * `updateLayout()`, so its `onLayoutMeasure` must not fire either.
     * @returns The page-space rect, or `null` before mount / without a window.
     *
     * @example
     * ```ts
     * const before = adapter.measurePageRect('snapshot')
     * // ...DOM patch...
     * const after = adapter.measurePageRect('measure')
     * // Cache refresh only, no listener notification:
     * const quiet = adapter.measurePageRect('measure', { silent: true })
     * ```
     */
    measurePageRect(phase: Phase = 'measure', options?: { silent?: boolean }): RectLike | null {
        if (!this.element) return null
        this.updatePathScroll(phase)

        const restore = this.stripToBaseTransforms()
        let rect: RectLike
        try {
            // measure(false): motion-applied transforms are already stripped
            // PHYSICALLY above. `measure(true)`'s removeTransform step would
            // subtract `latestValues` transforms (e.g. Reorder.Item's live
            // drag x/y MotionValues, mirrored into the visual element via its
            // style) a SECOND time and report slot − offset instead of the
            // slot.
            rect = rectFromBox(this.projection.measure(false).layoutBox)
        } finally {
            restore()
        }
        // Notify after the inline transforms are restored so listeners
        // (e.g. Reorder.Item slot registration via `onLayoutMeasure`) see a
        // consistent DOM.
        if (options?.silent) {
            layoutMeasureStats.silentReads += 1
        } else {
            layoutMeasureStats.reads += 1
            for (const listener of this.measureListeners) listener(rect)
        }
        return rect
    }

    /**
     * Subscribe to every stripped page-space measurement this adapter takes.
     *
     * Fires once per successful {@link measurePageRect} — the same cadence
     * the retired legacy node's 'measure' event had (seed reads, snapshot
     * and measure phases, observed commits). `Reorder.Item` uses this via
     * `onLayoutMeasure` to keep its slot registered with the group.
     *
     * @param listener Called with the freshly measured page-space rect.
     * @returns Unsubscribe function.
     *
     * @example
     * ```ts
     * const off = adapter.onMeasure((rect) => registerSlot(rect))
     * ```
     */
    onMeasure(listener: (rect: RectLike) => void): () => void {
        this.measureListeners.add(listener)
        return () => {
            this.measureListeners.delete(listener)
        }
    }

    /**
     * Subscribe to upstream update passes that re-measured this node.
     *
     * Fires once per motion-dom `didUpdate` event on this projection node —
     * i.e. whenever the node was layout-dirty (snapshotted) in an update
     * pass and re-measured, whichever node triggered the pass. With
     * LayoutGroup node groups a sibling's `willUpdate` snapshots this node
     * and the sibling's commit animates it (plan 007 D4); the owning
     * container uses this to adopt the new rect as its cached layout so its
     * own DOM observers don't commit the same change a second time.
     *
     * The rect comes from the update pass's own measurement, so listening
     * costs no extra DOM read. Only adapters constructed with a `group`
     * fire; an ungrouped adapter's listeners are never called.
     *
     * @param listener Called with the freshly measured page-space rect.
     * @returns Unsubscribe function.
     *
     * @example
     * ```ts
     * const off = adapter.onProjectionCommit((rect) => (lastRect = rect))
     * ```
     */
    onProjectionCommit(listener: (rect: RectLike) => void): () => void {
        this.commitListeners.add(listener)
        return () => {
            this.commitListeners.delete(listener)
        }
    }

    /**
     * The last page-space layout rect this adapter measured (via
     * `seedLayout`/`measurePageRect`-backed commits), read from cache with
     * zero DOM access. `null` before the first seed.
     *
     * Use this to seed consumers that only need the current slot (e.g. the
     * `onLayoutMeasure` subscription's initial fire) without forcing a fresh
     * strip-and-reflow measurement.
     */
    get lastMeasuredRect(): RectLike | null {
        const box = this.lastLayout?.layoutBox
        return box ? rectFromBox(box) : null
    }

    /**
     * Convert an arbitrary element's viewport rect into THIS adapter's
     * page space — the same space `measurePageRect` measures in: viewport
     * rect plus the document root's phase-cached scroll, plus the offsets of
     * any `layoutScroll` ancestor containers that contain the element.
     *
     * This is the one sanctioned viewport→page conversion for elements the
     * projection tree doesn't manage (e.g. the presence wait-hold parent).
     * A hand-rolled `rect + window.scrollX/Y` is NOT equivalent inside a
     * scrolled `layoutScroll` container and would reintroduce the phantom
     * scroll-delta bug class this measurement scheme exists to prevent
     * (#437).
     *
     * @param target Element whose rect to convert; must be this element or
     * one of its DOM ancestors for the `layoutScroll` path walk to apply.
     * @param phase Scroll-cache phase for the offsets (see
     * {@link measurePageRect}).
     * @returns The element's rect in page space.
     */
    pageRectOf(target: Element, phase: Phase = 'measure'): RectLike {
        const rect = target.getBoundingClientRect()
        let left = rect.left
        let top = rect.top
        if (typeof window !== 'undefined') {
            this.updatePathScroll(phase)
            const root = this.projection.root
            if (root?.scroll) {
                left += root.scroll.offset.x
                top += root.scroll.offset.y
            }
            for (const node of this.projection.path) {
                if (node === root || !node.options.layoutScroll || !node.scroll) continue
                const container = MotionDomProjectionAdapter.adapters.get(node)?.element
                if (container?.contains(target)) {
                    left += node.scroll.offset.x
                    top += node.scroll.offset.y
                }
            }
        }
        return { left, top, width: rect.width, height: rect.height }
    }

    /**
     * Commit a dragged element's observed layout (slot) change and deliver
     * the slot delta instead of running a layout animation.
     *
     * Mirrors upstream drag semantics: `VisualElementDragControls` blocks the
     * dragged node's layout animation (`isAnimationBlocked`,
     * VisualElementDragControls.ts:139/293) and its `didUpdate` listener
     * shifts the gesture origin by `delta[axis].translate`
     * (VisualElementDragControls.ts:742-758). The delta orientation is
     * `snapshot - layout` (previous - next).
     *
     * The element is mid-gesture, so its inline transform carries the live
     * drag offset. Upstream strips it during the update pass via
     * `resetTransform` + `latestValues`; this bridge writes drag transforms
     * outside `latestValues` (the buildTransform writer), so the adapter
     * strips to base transforms itself for the duration of the pass and
     * restores in the `didUpdate` listener — the whole pass flushes on a
     * microtask, before paint, so the stripped state is never rendered.
     *
     * @param previousRect Pre-change slot rect (page space, stripped).
     * @param onSlotDelta Called with the (dx, dy) slot delta when the layout
     * actually changed; the caller routes it to the drag writer's
     * `adjustOrigin`.
     * @returns Nothing.
     *
     * @example
     * ```ts
     * adapter.commitDraggedLayoutChange(previous, (dx, dy) =>
     *     drag.adjustOrigin(dx, dy)
     * )
     * ```
     */
    commitDraggedLayoutChange(
        previousRect: RectLike,
        onSlotDelta: (dx: number, dy: number) => void
    ): void {
        if (!this.element || !this.layout) return

        const restore = this.stripToBaseTransforms()

        let finished = false
        const finish = () => {
            if (finished) return
            finished = true
            off()
            this.projection.isAnimationBlocked = false
            restore()
        }
        const off = this.projection.addEventListener(
            'didUpdate',
            ({ delta, hasLayoutChanged }: LayoutUpdateData) => {
                finish()
                if (hasLayoutChanged) {
                    onSlotDelta(delta.x.translate, delta.y.translate)
                }
            }
        )

        this.projection.isAnimationBlocked = true
        this.commitObservedLayoutChange(previousRect)

        // Safety net: `didUpdate` fires within the upstream microtask flush;
        // if the pass bails (e.g. update blocked), never leave the element
        // stripped or the node animation-blocked. Double-nested so it runs
        // after motion-dom's own microtask.
        queueMicrotask(() => queueMicrotask(finish))
    }

    /**
     * Animate from the last cached layout to the current observed layout.
     *
     * This covers layout changes discovered after the mutation by observers.
     * Svelte runes mode doesn't expose the same component pre/post-update
     * hooks Framer Motion uses in React, so this adapter reuses upstream
     * projection while the Svelte component controls the snapshot timing.
     *
     * @param previousRect Optional pre-update rect used to seed the root
     * projection snapshot.
     * @param options.ownSubtreeChanged This node's own props or DOM subtree
     * changed (not just its position). Descendants in a separate LayoutGroup
     * node group are then snapshotted too, as upstream's re-render would.
     * @returns Nothing.
     *
     * @example
     * ```ts
     * adapter.commitObservedLayoutChange()
     * ```
     */
    commitObservedLayoutChange(
        previousRect?: RectLike,
        options?: { ownSubtreeChanged?: boolean }
    ): void {
        // A `layoutId`-only node counts: it has a measured layout (`seedLayout`
        // runs on mount regardless of props) and motion-dom already knows its
        // `layoutId` from `setOptions`, so seeding a snapshot animates it exactly
        // as it animates a `layout` node. That is what lets the container's
        // shared-layout effect hand a departing element's rect to the projection
        // instead of hand-writing a FLIP (drag-single-writer 005).
        if (!this.element || !(this.layout || this.layoutId)) return
        const snapshot = previousRect
            ? measurementsFromRect(previousRect, this.lastLayout ?? this.projection.layout)
            : this.lastLayout
        if (!snapshot) {
            this.seedLayout()
            return
        }

        this.projection.root?.startUpdate()
        // (a) + (c): this node and its same-group (or, ungrouped, all
        // ungrouped) descendants — every descendant when this node's own
        // subtree changed (upstream: the subtree re-rendered, so every
        // descendant's MeasureLayout snapshotted itself; Step 4b-d).
        this.seedCachedSnapshotsForSubtree(
            this.projection,
            snapshot,
            options?.ownSubtreeChanged ?? false
        )
        // (b): the other members of this node's LayoutGroup node group.
        this.seedCachedSnapshotsForGroup()
        this.projection.root?.didUpdate()
        this.refreshCachedLayout()
    }

    /**
     * Re-commit every mounted member of a LayoutGroup node group from its
     * cached (or, mid-animation, on-screen) snapshot and run one update pass
     * (plan 007 D7). The Svelte counterpart of upstream `forceRender`: a
     * member whose layout changed since its last pass animates from where it
     * was; a member already animating toward the same target keeps its
     * animation (motion-dom only restarts on a changed target); an unchanged
     * idle member is a no-op.
     *
     * @param group The group to re-commit.
     * @returns Nothing.
     *
     * @example
     * ```ts
     * frame.postRender(() => MotionDomProjectionAdapter.commitGroup(group))
     * ```
     */
    static commitGroup(group: NodeGroup): void {
        const members = MotionDomProjectionAdapter.groupMembers.get(group)
        const member = members && [...members].find((candidate) => candidate.element)
        if (!member) return
        const root = member.projection.root
        root?.startUpdate()
        // Seeds every OTHER member, then this one from the same source.
        const seeded = member.seedCachedSnapshotsForGroup() + member.seedOwnOnScreenSnapshot()
        if (seeded > 0) root?.didUpdate()
    }

    /**
     * Whether an observed change of this node's rect is fully explained by
     * its nearest projecting ancestor's own layout update (plan 007 D6).
     *
     * A node in a separate LayoutGroup node group (`inherit="id"` /
     * `inherit={false}`) is not snapshotted by the outer group's updates:
     * upstream never re-measures it and it rides its parent's projection
     * instead. The observer path still SEES the DOM move, though, so the
     * container asks this before committing: when this node's offset from
     * its ancestor is unchanged, the move is the ancestor's, and this node
     * must only refresh its cache.
     *
     * The ancestor's "previous" layout is its pre-change layout either way
     * round the two paths race: when its update pass already ran for this
     * change (its current rect equals that pass's result) it is the pass's
     * snapshot, otherwise it is its still-cached layout.
     *
     * @param previousRect This node's cached pre-change rect (page space).
     * @param nextRect This node's freshly measured rect (page space).
     * @returns `true` when this node is grouped, not layout-dirty, and its
     * offset from its nearest projecting ancestor (which moved) is unchanged.
     *
     * @example
     * ```ts
     * if (adapter.isFollowingAncestorUpdate(previous, next)) refreshCache()
     * else adapter.commitObservedLayoutChange(previous)
     * ```
     */
    isFollowingAncestorUpdate(previousRect: RectLike, nextRect: RectLike): boolean {
        if (!this.element || !this.group || this.projection.isLayoutDirty) return false
        if (!sameSize(previousRect, nextRect)) return false
        const ancestor = this.nearestProjectingAncestor()
        if (!ancestor) return false
        const ancestorNext = ancestor.measurePageRect('measure', { silent: true })
        if (!ancestorNext) return false
        const ancestorPrevious =
            ancestor.lastUpdate && rectsMatch(ancestor.lastUpdate.next, ancestorNext)
                ? ancestor.lastUpdate.previous
                : ancestor.lastMeasuredRect
        if (!ancestorPrevious || rectsMatch(ancestorPrevious, ancestorNext)) return false
        return (
            near(previousRect.left - ancestorPrevious.left, nextRect.left - ancestorNext.left) &&
            near(previousRect.top - ancestorPrevious.top, nextRect.top - ancestorNext.top)
        )
    }

    /**
     * Finish any active upstream layout animation in this subtree.
     *
     * @returns Nothing.
     *
     * @example
     * ```ts
     * adapter.finishAnimation()
     * ```
     */
    finishAnimation(): void {
        if (!this.element || !this.layout) return
        this.finishAnimationForSubtree(this.projection)
        this.seedLayout()
    }

    /**
     * Block this node from starting layout animations, then finish and re-seed.
     *
     * Unlike {@link finishAnimation}, which only stops what is running now, this
     * also sets the projection's `isAnimationBlocked` flag so a layout update
     * ALREADY SCHEDULED on the frameloop (an earlier `commitObservedLayoutChange`
     * whose `didUpdate` computes its target next frame) cannot resurrect the
     * animation. Used while a `layout` ancestor runs its size-corrected width
     * animation: the child must track the growing parent (identity transform),
     * never run its own re-slot FLIP — and the block is race-proof against a
     * commit that landed a beat before the size animation was detected. Mirrors
     * upstream's drag block (VisualElementDragControls `isAnimationBlocked`).
     *
     * @returns Nothing.
     */
    blockLayoutAnimation(): void {
        if (!this.element || !this.layout) return
        this.projection.isAnimationBlocked = true
        this.finishAnimationForSubtree(this.projection)
        this.seedLayout()
    }

    /**
     * Lift a prior {@link blockLayoutAnimation} block and re-seed to the current
     * layout, so subsequent real layout changes animate normally again.
     *
     * @returns Nothing.
     */
    unblockLayoutAnimation(): void {
        if (!this.element || !this.layout) return
        this.projection.isAnimationBlocked = false
        this.seedLayout()
    }

    /**
     * Check whether this projection subtree has an active layout animation.
     *
     * @returns `true` when this projection subtree is currently animating.
     *
     * @example
     * ```ts
     * if (adapter.isAnimating()) adapter.finishAnimation()
     * ```
     */
    isAnimating(): boolean {
        return this.isAnimatingSubtree(this.projection)
    }

    /**
     * Join the node group while mounted with `layout` / `layoutId` (the
     * condition under which upstream mounts `MeasureLayout`), leave it
     * otherwise.
     */
    private syncGroupMembership(): void {
        const group = this.group
        const shouldBeMember = !!(group && this.element && (this.layout || this.layoutId))
        if (shouldBeMember === this.isGroupMember) return
        if (group && shouldBeMember) {
            this.isGroupMember = true
            group.add(this.projection as unknown as IProjectionNode)
            let members = MotionDomProjectionAdapter.groupMembers.get(group)
            if (!members) {
                members = new Set()
                MotionDomProjectionAdapter.groupMembers.set(group, members)
            }
            members.add(this)
        } else {
            this.leaveGroup()
        }
    }

    private leaveGroup(): void {
        if (!this.isGroupMember || !this.group) return
        this.isGroupMember = false
        MotionDomProjectionAdapter.groupMembers.get(this.group)?.delete(this)
        this.group.remove(this.projection as unknown as IProjectionNode)
    }

    /** The nearest ancestor adapter that is mounted and projects layout. */
    private nearestProjectingAncestor(): MotionDomProjectionAdapter | null {
        let node = this.projection.parent
        while (node) {
            const adapter = MotionDomProjectionAdapter.adapters.get(node)
            if (adapter?.element && (adapter.layout || adapter.layoutId)) return adapter
            node = node.parent
        }
        return null
    }

    /**
     * Seed every other member of this node's group that isn't already
     * layout-dirty with its CACHED layout as its snapshot — the observer
     * path's equivalent of `nodeGroup.dirty()`: the change has already hit
     * the DOM, so `willUpdate(false)` would snapshot the new layout and
     * nothing would animate (plan 007 D5b).
     */
    private seedCachedSnapshotsForGroup(): number {
        if (!this.group) return 0
        const members = MotionDomProjectionAdapter.groupMembers.get(this.group)
        if (!members) return 0
        let seeded = 0
        for (const member of members) {
            if (member === this || !member.element) continue
            const projection = member.projection
            if (projection.isLayoutDirty) continue
            if (!(projection.options.layout || projection.options.layoutId)) continue
            const snapshot = member.onScreenSnapshot()
            if (!snapshot) continue
            this.prepareSnapshotPath(projection)
            projection.snapshot = snapshot
            projection.isLayoutDirty = true
            seeded += 1
        }
        return seeded
    }

    /** Seed this node from {@link onScreenSnapshot} unless already dirty. */
    private seedOwnOnScreenSnapshot(): number {
        const projection = this.projection
        if (projection.isLayoutDirty || !(this.layout || this.layoutId)) return 0
        const snapshot = this.onScreenSnapshot()
        if (!snapshot) return 0
        this.prepareSnapshotPath(projection)
        projection.snapshot = snapshot
        projection.isLayoutDirty = true
        return 1
    }

    /**
     * The best pre-change snapshot available without a DOM read. A node
     * mid layout animation is drawn at its projection `target`, not its
     * layout, and upstream's `willUpdate` snapshot measures that on-screen
     * box — seeding the layout instead would jump it to its old slot
     * (plan 007 Step 4b-a). Otherwise the cached layout.
     */
    private onScreenSnapshot(): Measurements | undefined {
        const target = this.projection.currentAnimation ? this.projection.target : undefined
        if (target) {
            return measurementsFromRect(
                rectFromBox(target),
                this.lastLayout ?? this.projection.layout
            )
        }
        return cloneMeasurements(this.lastLayout)
    }

    /**
     * Keep descendants that this node's update pass did NOT re-measure in
     * step: they follow this node (relative projection) without being
     * measured, so their DOM slot moved by this node's layout delta. A
     * descendant that WAS re-measured still holds its snapshot here (the
     * pass clears snapshots after notifying) and refreshes itself — and its
     * own subtree — from its own `didUpdate`.
     */
    private shiftFollowingDescendants(dx: number, dy: number): void {
        if (!dx && !dy) return
        const visit = (node: ProjectionTreeNode) => {
            for (const child of node.children) {
                if (child.snapshot) continue
                const layout = MotionDomProjectionAdapter.adapters.get(child)?.lastLayout
                if (layout) {
                    for (const box of [layout.layoutBox, layout.measuredBox]) {
                        box.x.min += dx
                        box.x.max += dx
                        box.y.min += dy
                        box.y.max += dy
                    }
                }
                visit(child)
            }
        }
        visit(this.projection as unknown as ProjectionTreeNode)
    }

    private seedCachedSnapshotsForSubtree<Instance>(
        projection: ProjectionTreeNode<Instance>,
        rootSnapshot?: Measurements,
        acrossGroups = false
    ): void {
        const adapter = MotionDomProjectionAdapter.adapters.get(projection)
        const isCommitter =
            projection === (this.projection as unknown as ProjectionTreeNode<Instance>)
        // (c) Group boundary: a descendant in a different node group (e.g.
        // inside `<LayoutGroup inherit="id">`) is left unseeded, so it keeps
        // following this node through motion-dom's relative projection.
        // Ungrouped committers still seed their ungrouped descendants,
        // exactly as before LayoutGroup owned node groups.
        // With `acrossGroups` (the committer's own subtree changed) the
        // boundary doesn't apply: upstream re-renders every descendant.
        if (!acrossGroups && !isCommitter && adapter?.group !== this.group) {
            for (const child of projection.children) {
                this.seedCachedSnapshotsForSubtree(child)
            }
            return
        }
        const snapshot = cloneMeasurements(
            isCommitter ? (rootSnapshot ?? adapter?.lastLayout) : adapter?.lastLayout
        )

        // `layoutId`-only nodes are seeded too — see `commitObservedLayoutChange`.
        if (snapshot && (projection.options.layout || projection.options.layoutId)) {
            this.prepareSnapshotPath(projection)
            projection.snapshot = snapshot
            projection.isLayoutDirty = true
        }

        for (const child of projection.children) {
            this.seedCachedSnapshotsForSubtree(child, undefined, acrossGroups)
        }
    }

    private prepareSnapshotPath<Instance>(projection: ProjectionTreeNode<Instance>): void {
        projection.root!.hasTreeAnimated = true

        for (const node of projection.path) {
            node.shouldResetTransform = true
            // Raw updateScroll (no same-phase invalidation à la
            // refreshNodeScroll): the caller ran root.startUpdate() first,
            // which bumped animationId and invalidated the cache naturally.
            node.updateScroll('snapshot')

            if (node.options.layoutRoot) {
                node.willUpdate(false)
            }
        }
    }

    private finishAnimationForSubtree<Instance>(projection: ProjectionTreeNode<Instance>): void {
        projection.finishAnimation()
        projection.targetDelta = projection.relativeTarget = projection.target = undefined
        projection.isProjectionDirty = true
        projection.scheduleRender()
        for (const child of projection.children) {
            this.finishAnimationForSubtree(child)
        }
    }

    private isAnimatingSubtree<Instance>(projection: ProjectionTreeNode<Instance>): boolean {
        if (projection.currentAnimation) return true
        for (const child of projection.children) {
            if (this.isAnimatingSubtree(child)) return true
        }
        return false
    }

    /**
     * Strip this element and every ancestor adapter's element to their
     * user-authored base transforms for a measurement, returning a closure
     * that restores the inline styles. Ancestors strip first (outer-most
     * transforms cascade down); restore runs in reverse — same ordering as
     * the retired legacy node's measure().
     *
     * Elements whose inline transform already equals their base exactly (an
     * idle element with a user-authored transform, or one motion has settled
     * back to base) are skipped, avoiding a no-op double style write. The
     * `'' → 'none'` write is NOT skipped: an inline `none` overrides a
     * stylesheet-authored transform during the read, and that stripping is
     * part of the measurement contract.
     */
    private stripToBaseTransforms(): () => void {
        const restoreList: Array<{ el: HTMLElement; prev: string }> = []
        const strip = (adapter: MotionDomProjectionAdapter) => {
            const el = adapter.element
            if (!el) return
            const prev = el.style.transform
            const base = adapter.getBaseTransform?.() ?? 'none'
            if (prev === base) return
            restoreList.push({ el, prev })
            el.style.transform = base
        }
        for (const node of this.projection.path) {
            const ancestor = MotionDomProjectionAdapter.adapters.get(node)
            if (ancestor) strip(ancestor)
        }
        strip(this)
        return () => {
            for (let i = restoreList.length - 1; i >= 0; i--) {
                restoreList[i].el.style.transform = restoreList[i].prev
            }
        }
    }

    /**
     * Refresh the phase-cached scroll offsets along this node's ancestor path
     * (including the shared window-mounted document root) plus the node
     * itself.
     *
     * Upstream keys the cache by `(root.animationId, phase)` and invalidates
     * it by bumping `animationId` in `startUpdate()`. The Svelte observer
     * bridge also takes standalone reads BETWEEN update passes (seeding,
     * post-patch measures) where `animationId` is static, so a repeat read of
     * the same phase must mark a NEW boundary: the matching cache entry is
     * invalidated (via an impossible `animationId`) before `updateScroll`
     * re-measures. `wasRoot` continuity is preserved because upstream derives
     * it from the existing entry rather than recomputing from scratch.
     */
    private updatePathScroll(phase?: Phase): void {
        for (const node of this.projection.path) {
            this.refreshNodeScroll(node, phase)
        }
        this.refreshNodeScroll(this.projection, phase)
    }

    private refreshNodeScroll<Instance>(node: IProjectionNode<Instance>, phase?: Phase): void {
        if (phase && node.scroll?.phase === phase) {
            node.scroll.animationId = -1
        }
        node.updateScroll(phase)
    }

    private refreshCachedLayout(): void {
        this.lastLayout = cloneMeasurements(this.projection.layout)
        if (typeof window === 'undefined') return
        // Cancel any prior pending refresh so only the latest frame writes, and
        // so unmount() can drop it entirely (upstream cancels its equivalent in
        // unmount — create-projection-node.ts: cancelFrame(this.updateProjection)).
        if (this.refreshRafId !== null) cancelAnimationFrame(this.refreshRafId)
        this.refreshRafId = requestAnimationFrame(() => {
            this.refreshRafId = null
            // A frame that arrives after unmount must not resurrect lastLayout
            // from the stale projection.layout and seed a remount's first commit.
            if (!this.element) return
            this.lastLayout = cloneMeasurements(this.projection.layout)
        })
    }
}
