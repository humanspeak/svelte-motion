import {
    HTMLProjectionNode,
    HTMLVisualElement,
    copyBoxInto,
    createBox,
    visualElementStore,
    type IProjectionNode,
    type LayoutUpdateData,
    type Measurements,
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

const boxFromRect = (rect: RectLike) => {
    const box = createBox()
    box.x.min = rect.left
    box.x.max = rect.left + rect.width
    box.y.min = rect.top
    box.y.max = rect.top + rect.height
    return box
}

const measurementsFromRect = (rect: RectLike, base: Measurements | undefined): Measurements => ({
    animationId: base?.animationId ?? 0,
    measuredBox: boxFromRect(rect),
    layoutBox: boxFromRect(rect),
    latestValues: { ...(base?.latestValues ?? {}) },
    source: base?.source ?? 0
})

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

    readonly visualElement: ProjectionVisualElement
    readonly projection: IProjectionNode<HTMLElement>

    private element: HTMLElement | null = null
    private layout: LayoutOption
    private layoutId: string | undefined
    private transition: Transition | undefined
    private lastLayout: Measurements | undefined
    private readonly getBaseTransform: (() => string) | undefined
    private readonly measureListeners = new Set<(rect: RectLike) => void>()

    constructor(options: MotionDomProjectionOptions = {}) {
        const parent = options.parent ?? null
        this.getBaseTransform = options.getBaseTransform
        this.visualElement = new HTMLVisualElement(
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

        this.visualElement.update(
            {
                transition: options.transition,
                style: options.style
            } as never,
            null
        )
        this.projection.setOptions({
            layout: options.layout,
            layoutId: options.layoutId,
            layoutScroll: options.layoutScroll,
            animationType: animationTypeForLayout(options.layout),
            transition: options.transition,
            visualElement: this.visualElement
        })
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
        this.visualElement.mount(element)
        this.seedLayout()
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
        this.visualElement.unmount()
        visualElementStore.delete(element)
        MotionDomProjectionAdapter.adapters.delete(this.projection)
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
        if (!this.element || !this.layout) return
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
        if (!this.element || !this.layout) return
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
     * @returns The page-space rect, or `null` before mount / without a window.
     *
     * @example
     * ```ts
     * const before = adapter.measurePageRect('snapshot')
     * // ...DOM patch...
     * const after = adapter.measurePageRect('measure')
     * ```
     */
    measurePageRect(phase: Phase = 'measure'): RectLike | null {
        if (!this.element) return null
        this.updatePathScroll(phase)

        const restoreList = this.collectBaseTransformResets()
        let rect: RectLike
        try {
            this.applyBaseTransformResets(restoreList)
            // measure(false): motion-applied transforms are already stripped
            // PHYSICALLY above. `measure(true)`'s removeTransform step would
            // subtract `latestValues` transforms (e.g. Reorder.Item's live
            // drag x/y MotionValues, mirrored into the visual element via its
            // style) a SECOND time and report slot − offset instead of the
            // slot.
            const { layoutBox } = this.projection.measure(false)
            rect = {
                left: layoutBox.x.min,
                top: layoutBox.y.min,
                width: layoutBox.x.max - layoutBox.x.min,
                height: layoutBox.y.max - layoutBox.y.min
            }
        } finally {
            this.restoreBaseTransformResets(restoreList)
        }
        // Notify after the inline transforms are restored so listeners
        // (e.g. Reorder.Item slot registration via `onLayoutMeasure`) see a
        // consistent DOM.
        for (const listener of this.measureListeners) listener(rect)
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

        const restoreList = this.collectBaseTransformResets()
        this.applyBaseTransformResets(restoreList)

        let finished = false
        const finish = () => {
            if (finished) return
            finished = true
            off()
            this.projection.isAnimationBlocked = false
            this.restoreBaseTransformResets(restoreList)
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
     * @returns Nothing.
     *
     * @example
     * ```ts
     * adapter.commitObservedLayoutChange()
     * ```
     */
    commitObservedLayoutChange(previousRect?: RectLike): void {
        if (!this.element || !this.layout) return
        const snapshot = previousRect
            ? measurementsFromRect(previousRect, this.lastLayout ?? this.projection.layout)
            : this.lastLayout
        if (!snapshot) {
            this.seedLayout()
            return
        }

        this.projection.root?.startUpdate()
        this.seedCachedSnapshotsForSubtree(this.projection, snapshot)
        this.projection.root?.didUpdate()
        this.refreshCachedLayout()
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

    private seedCachedSnapshotsForSubtree<Instance>(
        projection: ProjectionTreeNode<Instance>,
        rootSnapshot?: Measurements
    ): void {
        const adapter = MotionDomProjectionAdapter.adapters.get(projection)
        const snapshot = cloneMeasurements(
            projection === (this.projection as unknown as ProjectionTreeNode<Instance>)
                ? (rootSnapshot ?? adapter?.lastLayout)
                : adapter?.lastLayout
        )

        if (snapshot && projection.options.layout) {
            this.prepareSnapshotPath(projection)
            projection.snapshot = snapshot
            projection.isLayoutDirty = true
        }

        for (const child of projection.children) {
            this.seedCachedSnapshotsForSubtree(child)
        }
    }

    private prepareSnapshotPath<Instance>(projection: ProjectionTreeNode<Instance>): void {
        projection.root!.hasTreeAnimated = true

        for (const node of projection.path) {
            node.shouldResetTransform = true
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
     * Collect the inline-transform resets needed for a stripped measurement:
     * this element and every ancestor adapter's element, reset to their
     * user-authored base transforms. Ancestors first (outer-most transforms
     * cascade down); restore in reverse — same ordering as the legacy node's
     * measure().
     */
    private collectBaseTransformResets(): Array<{ el: HTMLElement; prev: string; base: string }> {
        const restoreList: Array<{ el: HTMLElement; prev: string; base: string }> = []
        for (const node of this.projection.path) {
            const ancestor = MotionDomProjectionAdapter.adapters.get(node)
            if (ancestor?.element) {
                restoreList.push({
                    el: ancestor.element,
                    prev: ancestor.element.style.transform,
                    base: ancestor.getBaseTransform?.() ?? 'none'
                })
            }
        }
        if (this.element) {
            restoreList.push({
                el: this.element,
                prev: this.element.style.transform,
                base: this.getBaseTransform?.() ?? 'none'
            })
        }
        return restoreList
    }

    private applyBaseTransformResets(
        restoreList: Array<{ el: HTMLElement; prev: string; base: string }>
    ): void {
        for (const { el, base } of restoreList) el.style.transform = base
    }

    private restoreBaseTransformResets(
        restoreList: Array<{ el: HTMLElement; prev: string; base: string }>
    ): void {
        for (let i = restoreList.length - 1; i >= 0; i--) {
            restoreList[i].el.style.transform = restoreList[i].prev
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
        for (const node of [...this.projection.path, this.projection]) {
            if (phase && node.scroll?.phase === phase) {
                node.scroll.animationId = -1
            }
            node.updateScroll(phase)
        }
    }

    private refreshCachedLayout(): void {
        this.lastLayout = cloneMeasurements(this.projection.layout)
        requestAnimationFrame(() => {
            this.lastLayout = cloneMeasurements(this.projection.layout)
        })
    }
}
