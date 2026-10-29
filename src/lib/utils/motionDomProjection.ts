import {
    HTMLProjectionNode,
    HTMLVisualElement,
    copyBoxInto,
    createBox,
    hasTransform,
    rootProjectionNode,
    transformPropOrder,
    translateAxis,
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
import type { LayoutChangeCause } from './layout'
import {
    isResizeBlocked,
    onResizeSettled,
    readScrollBasis,
    scheduleResample,
    scrollShift,
    type FoldedIn,
    type ScrollBasis
} from './scrollBasis'

type ProjectionVisualElement = VisualElement & {
    latestValues: ResolvedValues
    projection?: IProjectionNode<HTMLElement>
}
type ProjectionTreeNode<Instance = unknown> = IProjectionNode<Instance>

type LayoutOption = boolean | string | undefined
type AnimationType = 'position' | 'x' | 'y' | 'size' | 'both' | 'preserve-aspect'
type RectLike = { left: number; top: number; width: number; height: number }
type Box = ReturnType<typeof createBox>

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
    /** Makes this node a layout root. Creation-time only: omit the key to leave it unchanged. */
    layoutRoot?: boolean
    /** Anchor point on the parent for relative projection, or `false` to turn it off. */
    layoutAnchor?: { x: number; y: number } | false
    /** Forwarded so `NodeStack.promote` can compare it, as upstream `layoutOptions` does. */
    layoutDependency?: unknown
    /** Transition passed to the upstream layout animation builder. */
    transition?: Transition
    /** Inline style props passed through to the visual element. */
    style?: unknown
    /** Upstream projection option (`use-visual-element.ts`): `true` for draggable elements. */
    alwaysMeasureLayout?: boolean
    /**
     * The node takes no snapshot of its own unless its `layoutDependency`
     * changed (`isLayoutMeasurementGated`), as upstream's `MeasureLayout`
     * decides from the `layoutDependency` it is given (MeasureLayout.tsx:43-52
     * @ v14.7.1). Part D (plan 015b) never seeds such a node.
     */
    measurementGated?: boolean
}

/**
 * Upstream `roundBox` (create-projection-node.ts 2550-2575 @ v14.7.1):
 * measured boxes are rounded in Safari and left untouched elsewhere, so
 * non-integer layouts inside scaled elements don't jump.
 */
const roundMeasuredPoint =
    typeof navigator !== 'undefined' &&
    navigator.userAgent.toLowerCase().includes('applewebkit/') &&
    !navigator.userAgent.toLowerCase().includes('chrome/')
        ? Math.round
        : (value: number) => value

const roundBox = (box: Box): void => {
    box.x.min = roundMeasuredPoint(box.x.min)
    box.x.max = roundMeasuredPoint(box.x.max)
    box.y.min = roundMeasuredPoint(box.y.min)
    box.y.max = roundMeasuredPoint(box.y.max)
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
 * Whether any layout update or unmount has run yet, across every adapter.
 *
 * Upstream's module-level `hasTakenAnySnapshot` (framer-motion
 * `motion/features/layout/MeasureLayout.tsx` @ v14.2.0, 23-31): set in
 * `getSnapshotBeforeUpdate` and `componentWillUnmount`, read in
 * `componentDidMount`. Until it is set, a mounting node has nothing to join,
 * so its root update is skipped.
 */
let hasTakenAnySnapshot = false

/**
 * Whether Motion's own transform animation for this VisualElement is running
 * on the compositor.
 *
 * Motion 14.2 groups an element's independent transforms (`x`, `y`, `scale`,
 * `rotate`, …) into one accelerated WAAPI `transform` animation. While it
 * runs there, each grouped value's `animation.liveValue()` (public
 * `MotionValueAnimation` type) returns the value the compositor is showing;
 * on the main thread, or when idle, it returns `undefined`. Independent
 * transforms only reach the compositor through that group, so this is the
 * public-API equivalent of upstream's `transformGroups.get(instance)` check
 * (motion-dom `create-projection-node.ts` @ v14.2.0, 123-124).
 *
 * @param visualElement - The element's VisualElement.
 * @returns `true` while any of its transform values runs on the compositor.
 */
const hasAcceleratedMotionTransform = (visualElement: VisualElement): boolean => {
    for (const key of transformPropOrder) {
        const animation = visualElement.getValue(key)?.animation
        if (animation?.liveValue?.() !== undefined) return true
    }
    return false
}

/**
 * The `transform` string Motion renders for this element that upstream
 * would keep for a layout read, or `undefined`.
 *
 * A VisualElement can carry a whole `transform` string as a value of its own
 * (`animate(el, { transform })` animates the component's VisualElement —
 * motion `animate/subject.ts` @ v14.2.0, 143-157 — and a declarative
 * `transform` target does the same). It is rendered inline, and it isn't one
 * of the independent transforms `hasTransform(latestValues)` looks at, so
 * upstream's `resetTransform()` leaves it applied for both the "before" and
 * "after" reads unless the node has a non-zero projection delta, independent
 * transforms or a changed `transformTemplate` (motion-dom
 * `create-projection-node.ts` @ v14.2.0, 999-1031; the template is
 * `visualElement.getProps().transformTemplate`, 666-669). The width change's
 * projection then replaces it inline (`applyProjectionStyles`, 2066-2076,
 * `'none'` once idle, 2050-2055), so the element drops into its row in one
 * frame with no vertical delta.
 *
 * svelte-motion re-renders that value after every style patch, so keeping it
 * for the "before" read gives both reads the same box, like upstream. A
 * transform the page wrote straight to `el.style` is different: Svelte's
 * `style` attribute patch drops it, so the "after" read never sees it, and
 * the "before" read strips it to match.
 *
 * Unlike upstream, this ignores the projection delta: upstream only measures
 * at update boundaries, but svelte-motion's layout observers also re-read the
 * element while its projection runs, and those reads must reproduce the box
 * the update measured, or the projection's own style write would look like a
 * 40px layout move and start a second animation.
 *
 * @param projection - The element's projection node.
 * @param visualElement - The element's VisualElement.
 * @returns The transform to keep, or `undefined` to strip to the base.
 */
const upstreamKeptTransform = (
    projection: IProjectionNode<HTMLElement>,
    visualElement: VisualElement
): string | undefined => {
    const value = projection.latestValues.transform
    if (typeof value !== 'string' || value === '' || value === 'none') return undefined
    if (hasTransform(projection.latestValues)) return undefined
    const transformTemplate = visualElement.getProps().transformTemplate
    const templateValue = transformTemplate
        ? transformTemplate(projection.latestValues, '')
        : undefined
    if (templateValue !== projection.prevTransformTemplateValue) return undefined
    return value
}

/**
 * Collect the script-created WAAPI `transform` effects targeting an element,
 * without changing anything (the read half of a detach).
 *
 * CSS animations and transitions (recognised by `animationName` /
 * `transitionProperty`, so this works where the `CSSAnimation` /
 * `CSSTransition` globals are absent) are never collected: they stay part of
 * the measured layout. Each animation's keyframes are read once.
 *
 * @param el - Element about to be measured.
 * @param into - Receives `[el, effect]` for every collected effect.
 */
const collectTransformEffects = (
    el: HTMLElement,
    into: Array<[HTMLElement, KeyframeEffect]>
): void => {
    if (typeof el.getAnimations !== 'function') return
    for (const animation of el.getAnimations()) {
        if ('animationName' in animation || 'transitionProperty' in animation) continue
        const effect = animation.effect as KeyframeEffect | null
        if (!effect || effect.target !== el || typeof effect.getKeyframes !== 'function') continue
        if (!effect.getKeyframes().some((keyframe) => 'transform' in keyframe)) continue
        into.push([el, effect])
    }
}

/** Whether two boxes match to within half a pixel on every edge. */
const sameBox = (a: Box, b: Box): boolean =>
    Math.abs(a.x.min - b.x.min) < 0.5 &&
    Math.abs(a.x.max - b.x.max) < 0.5 &&
    Math.abs(a.y.min - b.y.min) < 0.5 &&
    Math.abs(a.y.max - b.y.max) < 0.5

/**
 * Svelte lifecycle adapter for motion-dom's upstream projection node system.
 *
 * The public Svelte API stays unchanged (`layout`, `layoutId`, `transition`).
 * This adapter only translates those props into the same `HTMLProjectionNode`
 * and `HTMLVisualElement` internals Framer Motion uses.
 */
export class MotionDomProjectionAdapter {
    private static adapters = new WeakMap<object, MotionDomProjectionAdapter>()
    /** Mounted adapters by element, for {@link MotionDomProjectionAdapter.foldedInFor}. */
    private static byElement = new WeakMap<Element, MotionDomProjectionAdapter>()
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
    /** See {@link MotionDomProjectionUpdateOptions.measurementGated}. */
    private measurementGated = false
    /**
     * Set when {@link seedFollowingLayout} seeded this node: its next
     * `didUpdate` refreshes the cache and tells the commit listeners, as a
     * grouped node's always does.
     */
    private presenceSeeded = false
    /** Before/after layout of this node's most recent upstream update pass. */
    private lastUpdate: { previous: RectLike; next: RectLike } | null = null
    /**
     * Most recent page-space layout box ANY read produced for this node —
     * upstream `updateLayout()` (seeds, refreshes, every update pass that
     * re-measured it, whoever triggered the pass) and direct
     * `measurePageRect()` reads — kept in step with ancestor-follow shifts.
     * Unlike `lastLayout` (the observer path's snapshot cache, deliberately
     * advanced only at commit boundaries) this is purely "where the node's
     * layout was last seen", the idle source of {@link currentVisualPageRect}.
     */
    private latestLayoutBox: Box | undefined
    /**
     * The scroll basis (plan 015a) of the latest layout read, the one that
     * produced {@link latestLayoutBox}; `undefined` when nothing on the
     * element's path scrolls. The container stamps its own cached rect with
     * it right after a read.
     */
    lastReadScrollBasis: ScrollBasis | undefined
    /** The basis of the read that produced `projection.layout`. */
    private layoutBasis: ScrollBasis | undefined
    /** The basis of `lastLayout`, copied with it from `projection.layout`. */
    private lastLayoutBasis: ScrollBasis | undefined
    /**
     * How {@link latestLayoutBox} (and the `lastLayout` taken from the same
     * read) was measured, for the departing-lead snapshot. The adapter's own
     * reads (`seedLayout`, `refreshLayout`, `measurePageRect`) count as
     * keeping the style transforms, so the box is where the element was
     * drawn. A motion-dom update pass resets the transforms of the nodes it
     * measures first (`resetTransformStyle`, create-projection-node.ts @
     * v14.7.1), so its box is the transform-free layout.
     */
    private latestLayoutKeepsTransforms = true
    /**
     * Whether {@link latestLayoutBox} already shows `latestValues`
     * transforms, for {@link currentVisualPageRect} (plan 015a, from 007):
     * `seedLayout` reads without resetting anything, so a seed taken while
     * this node or an ancestor had a transform is the drawn box, and
     * applying the transforms again would count them twice. Every other read
     * resets them (`stripToBaseTransforms`, or upstream's `resetTransform`
     * in a pass, create-projection-node.ts @ v14.7.1, 1046-1076), as does a
     * seed with no transform to keep.
     */
    private latestLayoutIsDrawn = false
    /** Set while the adapter itself runs `updateLayout()`. */
    private readingOwnLayout = false
    /** Set while `seedLayout` runs its unstripped `updateLayout()`. */
    private readingUnstripped = false
    private offProjectionMeasure: (() => void) | null = null
    private offResizeSettled: (() => void) | null = null
    private readonly cacheRefreshListeners = new Set<(rect: RectLike) => void>()
    /**
     * Containers whose scroll this node's measurement already removes: the
     * `layoutScroll` nodes on its path (`removeElementScroll`,
     * create-projection-node.ts @ v14.7.1, 1126-1156). `wasRoot` when one of
     * them, or this node, is a scroll root, so `measurePageBox` adds no root
     * scroll (1105-1124). Decided whenever a delta is computed.
     */
    private readonly isFoldedIn: FoldedIn
    /** {@link isFoldedIn} plus this node's own element when it is `layoutScroll`. */
    private readonly isFoldedInWithSelf: FoldedIn

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
        const projection = this.projection
        const wasRoot = () =>
            !!projection.scroll?.wasRoot ||
            projection.path.some((node) => node !== node.root && !!node.scroll?.wasRoot)
        const isFoldedIn: FoldedIn = (container: Element) =>
            projection.path.some(
                (node) =>
                    node !== node.root && !!node.options.layoutScroll && node.instance === container
            )
        const isFoldedInWithSelf: FoldedIn = (container: Element) =>
            (!!projection.options.layoutScroll && this.element === container) ||
            isFoldedIn(container)
        for (const predicate of [isFoldedIn, isFoldedInWithSelf]) {
            Object.defineProperty(predicate, 'wasRoot', { get: wasRoot })
        }
        this.isFoldedIn = isFoldedIn
        this.isFoldedInWithSelf = isFoldedInWithSelf
    }

    /**
     * The scroll containers whose offsets are already folded into layout
     * measurements of `element` (plan 015a, for callers without a projection
     * node, such as exit clones): those of the nearest mounted adapter at or
     * above `element` (crossing shadow hosts), its own element included when
     * it is `layoutScroll`. With no such adapter, nothing is folded in.
     *
     * @param element The element whose position is tracked.
     * @returns The predicate, with `wasRoot` set when one of those nodes is a
     *     scroll root.
     *
     * @example
     * ```ts
     * const isFoldedIn = MotionDomProjectionAdapter.foldedInFor(slotParent)
     * const move = scrollDelta(before, after, isFoldedIn)
     * ```
     */
    static foldedInFor(element: Element): FoldedIn {
        for (
            let node: Element | null = element;
            node;
            node = node.parentElement ?? (node.parentNode as ShadowRoot | null)?.host ?? null
        ) {
            const adapter = MotionDomProjectionAdapter.byElement.get(node)
            if (adapter?.element) return adapter.isFoldedInWithSelf
        }
        return Object.assign(() => false, { wasRoot: false })
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
        // Once mounted, the node's layoutId is moved only by `switchLayoutId`
        // (#1411): upstream `MeasureLayout` re-syncs options by spreading
        // `projection.options` and never passes `layoutId` (`layoutOptions`,
        // MeasureLayout.tsx:43-52 @ v14.7.1), and `setOptions` alone doesn't
        // move a node between shared-layout stacks. Before mount the id still
        // flows in, so `mount()` registers the node with it.
        const layoutId = this.element ? this.projection.options.layoutId : options.layoutId
        this.layout = options.layout
        this.layoutId = layoutId
        this.transition = options.transition
        this.measurementGated = !!options.measurementGated

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
        // `layoutAnchor` and `layoutDependency` are synced on every update, as
        // upstream `layoutOptions` (MeasureLayout.tsx:43-52 @ v14.7.1).
        // `layoutRoot` is a creation option (use-visual-element.ts:229-248 @
        // v14.7.1): `setOptions` merges and an explicit `undefined` would
        // overwrite, so it's written only when the caller passes the key.
        this.projection.setOptions({
            layout: options.layout,
            layoutId,
            layoutScroll: options.layoutScroll,
            ...('layoutRoot' in options ? { layoutRoot: options.layoutRoot } : {}),
            layoutAnchor: options.layoutAnchor,
            layoutDependency: options.layoutDependency,
            alwaysMeasureLayout: options.alwaysMeasureLayout,
            animationType: animationTypeForLayout(options.layout),
            transition: options.transition,
            visualElement: this.visualElement
        })
        this.syncGroupMembership()
    }

    /** Whether the adapter is currently mounted to an element. */
    get isMounted(): boolean {
        return this.element !== null
    }

    /**
     * Whether the takeover returned by the latest {@link switchLayoutId} found
     * the new stack's lead still on screen, so it hid that lead and kept this
     * node's own snapshot (an instant takeover, nothing to animate from).
     * Reset by every `switchLayoutId` call, set when its takeover runs.
     */
    lastSwitchTookOver = false

    /**
     * Move a mounted node to its new `layoutId`'s shared-layout stack, as an
     * unmount and remount would (#1411).
     *
     * Line-for-line port of framer-motion `switchLayoutId`
     * (`MeasureLayout.tsx:59-106 @ v14.7.1`). Call it after `willUpdate()` for
     * an update, or on its own when the node gains an id as `MeasureLayout`
     * mounts. Run the returned takeover once every node in the update has had
     * the chance to change its `layoutId`.
     *
     * @param layoutId The node's new (scoped) layoutId, or `undefined` to leave
     *     shared layout.
     * @returns A takeover to run after every switch in this update, or
     *     `undefined` when the node left shared layout.
     *
     * @example
     * ```ts
     * adapter.willUpdate()
     * const takeOver = adapter.switchLayoutId('group-highlight')
     * // ...after the DOM update, once every node has switched:
     * adapter.commitLayoutIdChange(takeOver)
     * ```
     */
    switchLayoutId(layoutId: string | undefined): (() => void) | undefined {
        // Stacks hold untyped nodes (`IProjectionNode<unknown>`).
        const projection = this.projection as unknown as IProjectionNode
        this.lastSwitchTookOver = false
        const { snapshot } = projection
        const stack = projection.getStack()
        stack?.remove(projection)
        // If this node led the old stack (so remove() made it the prevLead of
        // the new lead), the new lead animates from this node's snapshot,
        // which it now holds. Unlike a node that unmounts, this one stays
        // mounted, so unlink them: the new lead mustn't read this node's
        // snapshot after it changes, or stop or share its animation.
        const lead = stack?.lead
        if (stack?.prevLead === projection && lead!.resumeFrom === projection)
            lead!.resumeFrom = lead!.currentAnimation = projection.resumingFrom = undefined
        projection.options.layoutId = layoutId
        this.layoutId = layoutId
        this.syncGroupMembership()

        // A node that followed another no longer does, so clear the styles
        // that hid it.
        if (!layoutId) {
            projection.needsShow = true
            return
        }
        projection.root!.registerSharedNode(layoutId, projection)
        // Upstream follows every switch with `setOptions({ ...projection.options,
        // ...layoutOptions(props) })` (MeasureLayout.tsx:141-145, 175-178 @
        // v14.7.1), whose `addLayoutListener()` gives a node that mounted with
        // neither `layout` nor `layoutId` its layout-animation handler. The
        // container's own `setOptions` may have run before this switch.
        projection.setOptions({ ...projection.options })

        // Like a mounting node, this one animates from the lead it replaces.
        // But if that lead is still on screen with this layoutId (e.g. an open
        // card moving to another thumbnail), this node is already on screen
        // too, so it takes over instantly: it keeps its own snapshot, and the
        // lead is hidden, as at the end of a crossfade. A lead that left the
        // stack in this update (e.g. layoutId={selected ? "x" : undefined}) is
        // animated from, as is one that's exiting.
        return () => {
            const { resumeFrom } = projection
            if (
                resumeFrom?.isPresent !== false &&
                projection.getStack()!.members.includes(resumeFrom!)
            ) {
                resumeFrom!.hide()
                projection.resumeFrom = undefined
                projection.snapshot = snapshot
                this.lastSwitchTookOver = true
            }
        }
    }

    /**
     * Close a `layoutId` change after Svelte has patched the DOM: run the
     * takeover from {@link switchLayoutId}, then the root update.
     *
     * Upstream `MeasureLayout.componentDidUpdate` (206-211 @ v14.7.1). Unlike
     * {@link didUpdate} it runs even when the node no longer has
     * `layout`/`layoutId`: upstream keeps `MeasureLayout` rendered for the
     * update that removes the id (`motion/index.tsx` @ v14.7.1).
     *
     * @param takeOver The takeover returned by `switchLayoutId`, if any.
     * @returns Nothing.
     *
     * @example
     * ```ts
     * adapter.commitLayoutIdChange(takeOver)
     * ```
     */
    commitLayoutIdChange(takeOver?: () => void): void {
        if (!this.element) return
        takeOver?.()
        this.projection.root?.didUpdate()
        this.visualElement.scheduleRenderMicrotask()
        this.refreshCachedLayout()
    }

    /**
     * Mount the upstream projection node to an element and seed its layout.
     *
     * @param element Element represented by the current motion component.
     * @param options `takeOverLiveLead: false` skips the mount-time takeover
     *     of a `layoutId` lead that is still on screen (see {@link didMount}),
     *     for a component that renders no layout measurement.
     * @returns Nothing.
     *
     * @example
     * ```ts
     * adapter.mount(element)
     * ```
     */
    mount(element: HTMLElement, options: { takeOverLiveLead?: boolean } = {}): void {
        if (this.element === element) return
        if (this.element) this.unmount()

        this.element = element
        MotionDomProjectionAdapter.adapters.set(this.projection, this)
        MotionDomProjectionAdapter.byElement.set(element, this)
        // An injected VisualElement may already be mounted by its owner; a
        // second mount would re-register it in `visualElementStore` and
        // re-bind its motion values. Seeding the layout still has to run.
        if (this.visualElement.current !== element) {
            this.visualElement.mount(element)
        }
        // Upstream `updateLayout()` notifies 'measure' with every layout it
        // reads for this node (create-projection-node.ts `updateLayout`), so
        // this costs no extra DOM read.
        this.offProjectionMeasure = this.projection.addEventListener('measure', (box: Box) => {
            this.layoutBasis = this.readBasis()
            this.rememberLayoutBox(
                box,
                this.layoutBasis,
                this.readingOwnLayout,
                this.readingUnstripped && this.hasPathTransforms()
            )
        })
        // A resize moves elements without resizing them, which no observer
        // sees: refresh the cache once the resize settles (plan 015a).
        this.offResizeSettled =
            typeof window === 'undefined' ? null : onResizeSettled(() => this.refreshAfterResize())
        this.seedLayout()
        this.mountedFromLiveLead = false
        // `promote()` copies the previous lead's snapshot (its foreign
        // `source` makes it shared) when that lead had one: a departing lead
        // seeded in `unmount()` below. Mark this node layout-dirty with its
        // path flagged for a transform reset, so the update pass re-measures
        // it the way upstream's `update()` does (`resetTransformStyle`, then
        // `updateLayout`, create-projection-node.ts @ v14.7.1): its mount-time
        // `seedLayout()` read kept its ancestors' style transforms.
        this.mountedFromSharedSnapshot = !!this.projection.resumeFrom?.snapshot
        if (this.mountedFromSharedSnapshot) {
            this.prepareSnapshotPath(this.projection as unknown as ProjectionTreeNode)
            this.projection.isLayoutDirty = true
        }
        // Registering with the layoutId's stack (projection `mount()` above)
        // promoted this node: `promote` gave it the previous lead as
        // `resumeFrom` (stack.ts:45-74 @ v14.7.1). `didMount` runs the update
        // pass for it when that lead is still on screen.
        this.mountTakeOverLead = options.takeOverLiveLead === false ? null : this.liveResumeFrom()
        // Grouped nodes are re-measured by passes they didn't trigger
        // themselves in a way the observer path must reconcile (plan 007
        // D4). An ungrouped node only is when part D seeded it (plan 015b),
        // and then never shifts its descendants (they weren't part of it).
        this.offProjectionDidUpdate = this.projection.addEventListener(
            'didUpdate',
            ({ layout, snapshot }: LayoutUpdateData) => {
                const seeded = this.presenceSeeded
                this.presenceSeeded = false
                if (!this.group) {
                    if (!seeded) return
                    this.copyLayoutToCache()
                    const rect = rectFromBox(layout)
                    this.lastUpdate = { previous: rectFromBox(snapshot.layoutBox), next: rect }
                    for (const listener of this.commitListeners) listener(rect)
                    return
                }
                // This node was layout-dirty and re-measured in an
                // upstream update pass, whoever triggered it (its own
                // commit, a group sibling's fan-out, a same-group
                // ancestor's subtree seed): keep the cached snapshot the
                // observer path fans out (D5) in step.
                this.copyLayoutToCache()
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
        // MeasureLayout.componentWillUnmount (148), which only exists for
        // nodes that measure layout.
        if (this.layout || this.layoutId) hasTakenAnySnapshot = true
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
        this.seedDepartingLeadSnapshot(element)
        this.offProjectionDidUpdate?.()
        this.offProjectionDidUpdate = null
        this.offProjectionMeasure?.()
        this.offProjectionMeasure = null
        this.offResizeSettled?.()
        this.offResizeSettled = null
        this.latestLayoutBox = undefined
        this.lastReadScrollBasis = undefined
        this.lastUpdate = null
        // An injected VisualElement may already have been unmounted by its
        // owner; unmounting twice would re-run the projection/feature teardown.
        if (this.visualElement.current) this.visualElement.unmount()
        visualElementStore.delete(element)
        MotionDomProjectionAdapter.adapters.delete(this.projection)
        if (MotionDomProjectionAdapter.byElement.get(element) === this) {
            MotionDomProjectionAdapter.byElement.delete(element)
        }
        if (this.refreshRafId !== null && typeof window !== 'undefined') {
            cancelAnimationFrame(this.refreshRafId)
        }
        this.refreshRafId = null
        this.element = null
        this.lastLayout = undefined
        this.lastLayoutBasis = undefined
        this.layoutBasis = undefined
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
        // MeasureLayout.getSnapshotBeforeUpdate (90).
        hasTakenAnySnapshot = true
        // `layoutId`-only nodes snapshot too — upstream mounts MeasureLayout
        // for `layout || layoutId`, and a grouped layoutId node's willUpdate
        // is what fans out to its group (plan 007 Step 4b-c).
        if (!this.element || !(this.layout || this.layoutId)) return
        this.projection.willUpdate()
    }

    /**
     * Run upstream `MeasureLayout.componentDidMount`'s root update.
     *
     * Once any snapshot has been taken anywhere, a mounting node flushes the
     * root update (`if (hasTakenAnySnapshot) projection.root.didUpdate()`,
     * MeasureLayout.tsx @ v14.2.0, 51-53), so it joins an update pass already
     * in progress and the cached layout is refreshed. Never `willUpdate()`s:
     * a mount isn't a layout update.
     *
     * @returns Nothing.
     *
     * @example
     * ```ts
     * // Layout measuring just mounted (or was turned back on).
     * adapter.didMount()
     * ```
     */
    didMount(): void {
        if (!this.element) return
        const lead = this.mountTakeOverLead
        this.mountTakeOverLead = null
        if (lead && lead === this.liveResumeFrom()) {
            this.takeOverLiveLeadOnMount(lead)
            return
        }
        if (!hasTakenAnySnapshot) return
        this.projection.root?.didUpdate()
        this.refreshCachedLayout()
    }

    /**
     * Whether this node mounted by taking over a `layoutId` lead that was
     * still on screen, and so already animates from it (see
     * {@link didMount}). The container then only drops a registry handoff for
     * the same id, so the two never animate one change.
     */
    mountedFromLiveLead = false

    /**
     * Whether this node mounted resuming from a previous lead's snapshot (a
     * shared snapshot `promote()` handed over, see {@link unmount}), so
     * motion-dom already animates the handoff. The container then only drops
     * a registry entry for the same id, so the change never animates twice.
     */
    mountedFromSharedSnapshot = false

    /**
     * Give a departing `layoutId` lead the snapshot upstream takes while it
     * is still attached. Upstream's `unmount()` runs `willUpdate()` first
     * (create-projection-node.ts 668-678 @ v14.7.1), whose `updateSnapshot()`
     * (967-979) `measure()`s it (1080-1103): `measuredBox` is the page box
     * (`measurePageBox`, 1105-1127) and `layoutBox` that box with element
     * scroll (`removeElementScroll`, 1129-1159) and transforms
     * (`removeTransform`) removed, then rounded (`roundBox`, 2561-2575), with
     * its own id as `source`. `promote()` then hands that snapshot to the
     * arriving node, and the foreign `source` makes it a shared one
     * (`notifyLayoutUpdate`'s `isShared`), which #1935's `layoutRoot` math
     * needs.
     *
     * Svelte detaches the DOM before effect teardown reaches here, so that
     * `measure()` would read a zero box, which `updateSnapshot()` drops. The
     * box comes from cache instead: the animating target, else the last
     * layout read, rebased by any scroll since (plan 015a). Both are
     * scroll-removed. A read that kept the style transforms is already where
     * the element was drawn; a transform-free one gets its transforms
     * applied (`applyTransform`, transform only). The page box is then that
     * box with the element scroll added back.
     */
    private seedDepartingLeadSnapshot(element: HTMLElement): void {
        const projection = this.projection
        if (!projection.options.layoutId || element.isConnected || projection.snapshot) return
        const root = projection.root
        if (!root) return
        // `willUpdate` (708-714): a blocked root takes no snapshot.
        if (root.isUpdateBlocked()) return
        const cached = this.cachedVisualBase()
        if (!cached) return
        const { box, keepsTransforms } = cached
        // `willUpdate` (735): join an update already running.
        !root.isUpdating && root.startUpdate()
        this.prepareSnapshotPath(projection as unknown as ProjectionTreeNode)
        const node = projection as typeof projection & {
            removeElementScroll(box: Box): Box
            removeTransform(box: Box): Box
        }
        const drawn = keepsTransforms ? box : projection.applyTransform(box, true)
        const pageBox = this.addElementScroll(drawn)
        const layoutBox = node.removeTransform(node.removeElementScroll(pageBox))
        roundBox(layoutBox)
        projection.snapshot = {
            animationId: root.animationId,
            measuredBox: pageBox,
            layoutBox,
            latestValues: { ...projection.latestValues },
            source: projection.id
        }
        // `willUpdate()` returns before measuring a layout-dirty node.
        projection.isLayoutDirty = true
    }

    /**
     * The inverse of upstream `removeElementScroll` (create-projection-node.ts
     * 1129-1159 @ v14.7.1): a scroll-removed box back in page space. Undoes
     * the offset of every non-root `layoutScroll` path node from the last one
     * that `wasRoot`, with the same phase-cached `scroll` values.
     */
    private addElementScroll(box: Box): Box {
        const pageBox = createBox()
        copyBoxInto(pageBox, box)
        const projection = this.projection
        if (projection.scroll?.wasRoot) return pageBox
        const path = projection.path
        let start = 0
        for (let i = 0; i < path.length; i++) {
            const node = path[i]
            if (
                node !== projection.root &&
                node.scroll &&
                node.options.layoutScroll &&
                node.scroll.wasRoot
            ) {
                start = i
            }
        }
        for (let i = start; i < path.length; i++) {
            const node = path[i]
            const { scroll, options } = node
            if (node !== projection.root && scroll && options.layoutScroll) {
                translateAxis(pageBox.x, -scroll.offset.x)
                translateAxis(pageBox.y, -scroll.offset.y)
            }
        }
        return pageBox
    }

    /** The live lead `mount()` found for {@link didMount} to take over. */
    private mountTakeOverLead: IProjectionNode | null = null

    /**
     * The previous lead this node's stack handed it as `resumeFrom`, if that
     * lead is still present and attached.
     */
    private liveResumeFrom(): IProjectionNode | null {
        const lead = this.projection.resumeFrom
        if (!lead || !this.projection.options.layoutId) return null
        if (lead.isPresent === false) return null
        if (!(lead.instance as HTMLElement | undefined)?.isConnected) return null
        return lead
    }

    /**
     * Run the update pass of a node that mounted with the `layoutId` of a
     * lead that is still on screen, so it animates out of that lead and the
     * snapshot `promote` copied onto it is consumed.
     *
     * Upstream that pass comes with the commit that mounts the node: the
     * parent re-render makes the previous lead `willUpdate()` in
     * `MeasureLayout.getSnapshotBeforeUpdate` (149-204 @ v14.7.1) and
     * `componentDidUpdate` (206-218) calls `root.didUpdate()`. Then `promote`
     * (stack.ts:45-74 @ v14.7.1) finds the root updating, marks the new node
     * layout-dirty and hands it the lead's snapshot. A Svelte sibling doesn't
     * re-render, so nothing else here would run that pass. The lead is
     * snapshotted from its cached (pre-mount, in-flow) box rather than
     * re-measured, as the mount may already have moved it.
     */
    private takeOverLiveLeadOnMount(lead: IProjectionNode): void {
        hasTakenAnySnapshot = true
        const projection = this.projection
        const root = projection.root
        if (!root) return
        root.startUpdate()
        // `promote` measured the lead (`updateSnapshot`), as upstream's
        // `willUpdate()` would, transforms included. Keep that unless this
        // mount already moved the lead's layout, then fall back to its
        // cached pre-mount box.
        const leadAdapter = MotionDomProjectionAdapter.adapters.get(lead)
        const cached = leadAdapter?.onScreenSnapshot()
        const measured = lead.snapshot
        if (
            leadAdapter &&
            cached &&
            (!measured || !sameBox(measured.layoutBox, cached.layoutBox))
        ) {
            leadAdapter.prepareSnapshotPath(lead)
            lead.snapshot = cached
        }
        lead.isLayoutDirty = true
        if (lead.snapshot) {
            projection.snapshot = lead.snapshot
            projection.snapshot.latestValues = lead.animationValues || lead.latestValues
        }
        projection.isLayoutDirty = true
        this.mountedFromLiveLead = true
        root.didUpdate()
        this.visualElement.scheduleRenderMicrotask()
        this.refreshCachedLayout()
    }

    /**
     * Commit an upstream layout update after Svelte has patched the DOM.
     *
     * Like a React commit, it schedules the root update on the microtask
     * batcher's read step (`didUpdate` → `microtask.read(scheduleUpdate)`,
     * motion-dom `create-projection-node.ts` @ v14.2.0, 847-852) and then a
     * VisualElement render on its render step (`scheduleRenderMicrotask()`,
     * framer-motion `use-visual-element.ts` @ v14.2.0, 157-158). The render
     * must come after the update: when nothing moved, the update's
     * `finishAnimation` clears a finished projection's target (615-617,
     * 2445-2448), and only a render after that lets the element's own
     * transform show again (`applyProjectionStyles`, 2042-2055). Svelte's
     * per-commit render (`_MotionContainer`) runs before this deferred
     * commit, so it can't be the one.
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
        this.visualElement.scheduleRenderMicrotask()
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
        // Reads the element as drawn (see `latestLayoutIsDrawn`).
        this.readingUnstripped = true
        try {
            this.updateOwnLayout()
        } finally {
            this.readingUnstripped = false
        }
        this.copyLayoutToCache()
    }

    /** `projection.updateLayout()`, marked as the adapter's own read. */
    private updateOwnLayout(): void {
        this.readingOwnLayout = true
        try {
            this.projection.updateLayout()
        } finally {
            this.readingOwnLayout = false
        }
    }

    /** Whether this node or an ancestor has `latestValues` transforms. */
    private hasPathTransforms(): boolean {
        return (
            !!hasTransform(this.projection.latestValues) ||
            this.projection.path.some((node) => !!hasTransform(node.latestValues))
        )
    }

    /** `lastLayout = projection.layout`, with the basis of the read behind it. */
    private copyLayoutToCache(): void {
        this.lastLayout = cloneMeasurements(this.projection.layout)
        this.lastLayoutBasis = this.layoutBasis
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
            this.updateOwnLayout()
        } finally {
            restore()
        }
        this.copyLayoutToCache()
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
            const { layoutBox } = this.projection.measure(false)
            rect = rectFromBox(layoutBox)
            this.rememberLayoutBox(layoutBox, this.readBasis(), true, false)
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
     * costs no extra DOM read. Adapters constructed with a `group` fire for
     * every such pass; an ungrouped adapter only for a pass part D seeded it
     * into (plan 015b, {@link seedFollowingLayout}).
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
        return box ? rectFromBox(this.rebasedBox(box, this.lastLayoutBasis)) : null
    }

    /**
     * Where this element is currently drawn, in the same scroll-invariant
     * page space {@link measurePageRect} measures in — derived with ZERO DOM
     * reads.
     *
     * Composed from:
     * 1. the box: the projection `target` while this node is mid layout
     *    animation (or rides an animating relative parent) — that is the box
     *    motion-dom projects it onto; otherwise the last layout any read saw
     *    (seeds, refreshes, update passes, observer commits, group fan-outs,
     *    ancestor-follow shifts);
     * 2. the motion transforms: this node's and its ancestors' `latestValues`
     *    (`x`/`y`/`scale`…), applied like upstream
     *    `applyTransform(box, transformOnly = true)` — `layoutScroll` offsets
     *    stay removed, so a container or window scroll never moves the rect.
     *
     * This is the box upstream's `unmount()` → `willUpdate()` snapshot
     * measures for a departing `layoutId` node (create-projection-node.ts
     * `unmount`, `measuredBox` in `measure()`), which a shared handoff
     * animates from (`notifyLayoutUpdate` uses `snapshot.measuredBox` when
     * `isShared`). Svelte removes the DOM before effect teardown, so the
     * departing element can't measure itself; this accessor stands in.
     *
     * @returns The on-screen page-space rect, or `null` before mount / before
     * the first layout read.
     *
     * @example
     * ```ts
     * // In a teardown, after Svelte already detached the element:
     * const rect = adapter.currentVisualPageRect()
     * if (rect) registry.snapshot(id, rect)
     * ```
     */
    currentVisualPageRect(): RectLike | null {
        if (!this.element) return null
        const cached = this.cachedVisualBase()
        const base =
            cached ??
            (this.projection.layout && {
                box: this.rebasedBox(this.projection.layout.layoutBox, this.layoutBasis),
                isDrawn: false
            })
        if (!base) return null
        const box = createBox()
        copyBoxInto(box, base.box)
        // A box read with the transforms in place already shows them; adding
        // them again would count an ancestor's or its own translate twice.
        return rectFromBox(base.isDrawn ? box : this.projection.applyTransform(box, true))
    }

    /**
     * The box this node is drawn from, without a DOM read: the animating
     * target, else the last layout any read saw, else the cached layout,
     * each rebased by any scroll since it was read (plan 015a; the target is
     * relative to `projection.layout`, so it shares its basis), and whether
     * it already includes the transforms (see `latestLayoutKeepsTransforms`).
     */
    private cachedVisualBase():
        { box: Box; keepsTransforms: boolean; isDrawn: boolean } | undefined {
        const target = this.visualTargetBox()
        if (target) {
            const box = this.rebasedBox(target, this.layoutBasis)
            return { box, keepsTransforms: false, isDrawn: false }
        }
        if (this.latestLayoutBox) {
            return {
                box: this.rebasedBox(this.latestLayoutBox, this.lastReadScrollBasis),
                keepsTransforms: this.latestLayoutKeepsTransforms,
                isDrawn: this.latestLayoutIsDrawn
            }
        }
        const layout = this.lastLayout?.layoutBox
        return (
            layout && {
                box: this.rebasedBox(layout, this.lastLayoutBasis),
                keepsTransforms: this.latestLayoutKeepsTransforms,
                isDrawn: false
            }
        )
    }

    /**
     * Whether a viewport rect the browser reported for this element (e.g. an
     * IntersectionObserver entry) is where the projection already thinks it
     * is drawn: {@link currentVisualPageRect}, moved into the viewport by the
     * live window and `layoutScroll` container scroll. `true` means the move
     * is explained by motion (a layout or transform animation, a scroll) and
     * the cached layout is still valid; `false` means the layout itself moved
     * without any update this adapter saw.
     *
     * Reads scroll offsets, never the element's box.
     *
     * @param viewportRect The element's reported viewport rect.
     * @param tolerance Allowed difference per edge, in px.
     * @returns Whether the cached state explains the rect.
     *
     * @example
     * ```ts
     * if (!adapter.isDrawnAt(entry.boundingClientRect)) adapter.measurePageRect()
     * ```
     */
    isDrawnAt(viewportRect: RectLike, tolerance = 1): boolean {
        // While this node or an ancestor layout-animates, every frame moves
        // it and only the projection knows where: a non-animating child of
        // an animating parent rides the parent's transform, which its own
        // cached layout doesn't encode. Those moves are motion by definition;
        // when the animation settles, the element's last move is checked
        // against the settled layout like any other.
        if (this.projection.currentAnimation) return true
        for (const node of this.projection.path) {
            if (node.currentAnimation) return true
        }
        const page = this.currentVisualPageRect()
        if (!page || typeof window === 'undefined') return false
        // Same document scroll source as upstream's root node
        // (DocumentProjectionNode `measureScroll`).
        const doc = document.documentElement
        let left = page.left - (doc.scrollLeft || document.body?.scrollLeft || 0)
        let top = page.top - (doc.scrollTop || document.body?.scrollTop || 0)
        const element = this.element
        for (const node of this.projection.path) {
            if (node === this.projection.root || !node.options.layoutScroll) continue
            const container = MotionDomProjectionAdapter.adapters.get(node)?.element
            if (container && element && container.contains(element)) {
                left -= container.scrollLeft
                top -= container.scrollTop
            }
        }
        return (
            Math.abs(viewportRect.left - left) <= tolerance &&
            Math.abs(viewportRect.top - top) <= tolerance &&
            Math.abs(viewportRect.width - page.width) <= tolerance &&
            Math.abs(viewportRect.height - page.height) <= tolerance
        )
    }

    /**
     * The projection target, when it — not the layout — is what's on screen:
     * this node is layout animating, or it follows (via a relative target) a
     * parent that is. Otherwise `undefined`: an idle node's `target` can be a
     * leftover of a finished animation.
     */
    private visualTargetBox(): Box | undefined {
        const projection = this.projection
        const target = projection.target
        if (!target) return undefined
        if (projection.currentAnimation) return target
        let parent = projection.relativeTarget ? projection.relativeParent : undefined
        while (parent) {
            if (parent.currentAnimation) return target
            parent = parent.relativeTarget ? parent.relativeParent : undefined
        }
        return undefined
    }

    private rememberLayoutBox(
        box: Box,
        basis: ScrollBasis | undefined,
        keepsTransforms: boolean,
        isDrawn: boolean
    ): void {
        if (!this.latestLayoutBox) this.latestLayoutBox = createBox()
        copyBoxInto(this.latestLayoutBox, box)
        this.lastReadScrollBasis = basis
        this.latestLayoutKeepsTransforms = keepsTransforms
        this.latestLayoutIsDrawn = isDrawn
    }

    /**
     * The scroll basis of a layout read just taken, or `undefined` when
     * nothing on the element's path scrolls (plan 015a). Reads scroll
     * offsets, never a box.
     */
    private readBasis(): ScrollBasis | undefined {
        if (!this.element || typeof window === 'undefined') return undefined
        const basis = readScrollBasis(this.element)
        return basis.scrollers.length || basis.fixedRoot || basis.unreliable ? basis : undefined
    }

    /**
     * How far a box read under `basis` has moved since by scrolling alone,
     * or `null` to keep it as it is (no basis, a sticky path, a resize since,
     * or no move). A non-zero shift schedules a tracker resample.
     */
    private shiftSince(basis: ScrollBasis | undefined): { x: number; y: number } | null {
        if (!basis) return null
        const shift = scrollShift(basis, this.isFoldedIn)
        if (!shift || (!shift.x && !shift.y)) return null
        scheduleResample()
        return shift
    }

    /** `box` rebased by any scroll since `basis` (a copy; `box` itself when unchanged). */
    private rebasedBox(box: Box, basis: ScrollBasis | undefined): Box {
        const shift = this.shiftSince(basis)
        if (!shift) return box
        const rebased = createBox()
        copyBoxInto(rebased, box)
        translateAxis(rebased.x, shift.x)
        translateAxis(rebased.y, shift.y)
        return rebased
    }

    /** A copy of `measurements`, rebased by any scroll since `basis`. */
    private rebasedMeasurements(
        measurements: Measurements | undefined,
        basis: ScrollBasis | undefined
    ): Measurements | undefined {
        const copy = cloneMeasurements(measurements)
        const shift = copy && this.shiftSince(basis)
        if (copy && shift) {
            for (const box of [copy.layoutBox, copy.measuredBox]) {
                translateAxis(box.x, shift.x)
                translateAxis(box.y, shift.y)
            }
        }
        return copy
    }

    /**
     * A page-space rect this adapter read earlier, moved by how far its
     * scroll containers have scrolled since (plan 015a). The container's
     * cached rect goes through this before it is compared with a fresh read.
     *
     * @param rect A rect from one of this adapter's reads, or `null`.
     * @param basis The {@link lastReadScrollBasis} that read was stamped with.
     * @returns The rect where the element's page box is now, `null` for `null`.
     *
     * @example
     * ```ts
     * const previous = adapter.rebaseRect(lastRect, lastRectBasis)
     * ```
     */
    rebaseRect(rect: RectLike | null, basis: ScrollBasis | undefined): RectLike | null {
        if (!rect) return null
        const shift = this.shiftSince(basis)
        if (!shift) return rect
        return { ...rect, left: rect.left + shift.x, top: rect.top + shift.y }
    }

    /**
     * Subscribe to cache refreshes the adapter takes on its own: once per
     * resize gesture, 250ms after the last resize event (plan 015a). The rect
     * is the refresh's read, so the owner can adopt it without a second read.
     *
     * @param listener Called with the refreshed page-space rect.
     * @returns Unsubscribe function.
     *
     * @example
     * ```ts
     * const off = adapter.onCacheRefresh((rect) => setLastRect(rect))
     * ```
     */
    onCacheRefresh(listener: (rect: RectLike) => void): () => void {
        this.cacheRefreshListeners.add(listener)
        return () => {
            this.cacheRefreshListeners.delete(listener)
        }
    }

    /**
     * Upstream re-measures every node after its resize block, without
     * animating (`create-projection-node.ts` @ v14.7.1, 797-820). One silent
     * read per mounted node, once the resize settles.
     */
    private refreshAfterResize(): void {
        if (!this.element) return
        const rect = this.refreshLayout({ silent: true })
        if (!rect) return
        for (const listener of this.cacheRefreshListeners) listener(rect)
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
     * @param options.previousBasis The scroll basis `previousRect` was read
     * in, for a caller holding a raw rect: it is rebased by any scroll since
     * (plan 015a). Omit it for a rect already rebased with
     * {@link rebaseRect}. Cached snapshots are always rebased.
     * @returns Nothing.
     *
     * @example
     * ```ts
     * adapter.commitObservedLayoutChange()
     * ```
     */
    commitObservedLayoutChange(
        previousRect?: RectLike,
        options?: { ownSubtreeChanged?: boolean; previousBasis?: ScrollBasis }
    ): void {
        // A `layoutId`-only node counts: it has a measured layout (`seedLayout`
        // runs on mount regardless of props) and motion-dom already knows its
        // `layoutId` from `setOptions`, so seeding a snapshot animates it exactly
        // as it animates a `layout` node. That is what lets the container's
        // shared-layout effect hand a departing element's rect to the projection
        // instead of hand-writing a FLIP (drag-single-writer 005).
        if (!this.element || !(this.layout || this.layoutId)) return
        const snapshot = previousRect
            ? measurementsFromRect(
                  this.rebaseRect(previousRect, options?.previousBasis)!,
                  this.lastLayout ?? this.projection.layout
              )
            : this.rebasedMeasurements(this.lastLayout, this.lastLayoutBasis)
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

    /** Layout parents part D ran for in this microtask (the M2 dedupe). */
    private static followParentsThisTick = new Set<Element>()
    /** Mutation batches part D already ran for. */
    private static followBatches = new WeakSet<MutationRecord[]>()

    /**
     * Part D (plan 015b): `layout` nodes after a list's layout parent but
     * outside it, such as a footer, follow a change of the list. Upstream
     * re-renders them with the list's owner, so their `MeasureLayout`
     * snapshots before the DOM changes (`getSnapshotBeforeUpdate`,
     * MeasureLayout.tsx:149-204 @ v14.7.1). Here the DOM has already changed,
     * so each node is seeded from its cached (rebased) layout, with no read,
     * and one update pass animates the ones that moved.
     *
     * When an exit completed, upstream re-renders only its `AnimatePresence`
     * and `LayoutGroup` (`AnimatePresence/index.tsx:206, 244`): the nodes
     * outside both are refreshed silently instead, one read each, so they
     * snap and a later change animates from where they now are (upstream
     * measures live, create-projection-node.ts:787, 967-978).
     *
     * The walk reads no layout: from the projection root it prunes subtrees
     * that precede `parent`, skips `parent`'s own line (itself, its ancestors
     * and descendants), and picks mounted, idle `layout` / `layoutId` nodes
     * that follow it, share its nearest motion ancestor (or the document),
     * aren't gated by `layoutDependency`, aren't in a size-animating box,
     * have a reliable cached layout, and don't already watch `parent`'s
     * subtree through their own parent. Runs once per mutation batch and
     * once per layout parent per microtask (the teardown of a completed
     * exit's element and the observers of its siblings report the same
     * change).
     *
     * @param parent The layout parent whose children changed.
     * @param records The observer batch, or `null` for a teardown call.
     * @param cause Why: `exit-complete` refreshes instead of seeding.
     * @returns Nothing.
     *
     * @example
     * ```ts
     * observeLayoutChanges(element, onChange, {
     *     onLayoutParentChange: (parent, records, cause) =>
     *         MotionDomProjectionAdapter.seedFollowingLayout(parent, records, cause)
     * })
     * ```
     */
    static seedFollowingLayout(
        parent: Element,
        records: MutationRecord[] | null,
        cause: LayoutChangeCause = { kind: 'change' }
    ): void {
        const self = MotionDomProjectionAdapter
        if (records) {
            if (self.followBatches.has(records)) return
            self.followBatches.add(records)
        }
        if (self.followParentsThisTick.has(parent)) return
        if (!self.followParentsThisTick.size) {
            queueMicrotask(() => self.followParentsThisTick.clear())
        }
        self.followParentsThisTick.add(parent)
        // During a resize block upstream measures without animating, and
        // every node refreshes once it settles (plan 015a).
        if (typeof window === 'undefined' || isResizeBlocked()) return
        const followers = self.followersOf(parent)
        if (!followers.length) return

        if (cause.kind === 'exit-complete') {
            for (const follower of followers) {
                if (follower.isRerenderedBy(cause)) continue
                const rect = follower.refreshLayout({ silent: true })
                if (!rect) continue
                for (const listener of follower.cacheRefreshListeners) listener(rect)
            }
            return
        }

        const root = followers[0].projection.root
        root?.startUpdate()
        for (const follower of followers) {
            const snapshot = follower.onScreenSnapshot()
            if (!snapshot) continue
            const projection = follower.projection
            follower.prepareSnapshotPath(projection as unknown as ProjectionTreeNode)
            projection.snapshot = snapshot
            projection.isLayoutDirty = true
            follower.presenceSeeded = true
        }
        root?.didUpdate()
        scheduleResample()
    }

    /** The nodes part D picks for `parent` (see {@link seedFollowingLayout}). */
    private static followersOf(parent: Element): MotionDomProjectionAdapter[] {
        const self = MotionDomProjectionAdapter
        let motionAncestor: Element | null = null
        for (let node = parent.parentElement; node; node = node.parentElement) {
            if (self.byElement.get(node)?.element) {
                motionAncestor = node
                break
            }
        }
        const root = rootProjectionNode.current
        const picked: MotionDomProjectionAdapter[] = []
        const visit = (node: ProjectionTreeNode) => {
            for (const child of node.children) {
                const instance = child.instance
                if (!(instance instanceof Element) || instance === parent) continue
                const position = instance.compareDocumentPosition(parent)
                // An ancestor of `parent`: skipped, its children visited.
                if (position & Node.DOCUMENT_POSITION_CONTAINED_BY) {
                    visit(child)
                    continue
                }
                // Inside `parent`, or before it: nothing in it follows.
                if (
                    position & Node.DOCUMENT_POSITION_CONTAINS ||
                    position & Node.DOCUMENT_POSITION_FOLLOWING
                ) {
                    continue
                }
                const adapter = self.adapters.get(child)
                if (adapter?.followsLayoutOf(parent, motionAncestor)) picked.push(adapter)
            }
        }
        if (root) visit(root)
        return picked
    }

    /** Whether part D picks this node, which follows `parent` in the document. */
    private followsLayoutOf(parent: Element, motionAncestor: Element | null): boolean {
        const element = this.element
        const projection = this.projection
        if (!element || !(this.layout || this.layoutId) || !this.lastLayout) return false
        if (projection.isLayoutDirty || this.measurementGated) return false
        if (element.closest('[data-layout-size-animation]')) return false
        // Its own observers already see `parent`'s subtree.
        if (element.parentElement?.contains(parent)) return false
        const basis = this.lastLayoutBasis
        if (basis && !scrollShift(basis, this.isFoldedIn)) return false
        const above = projection.parent
        const aboveElement = above && above !== above.root ? above.instance : null
        return (aboveElement ?? null) === motionAncestor
    }

    /** Whether a completed exit re-renders this node upstream (it then isn't snapped). */
    private isRerenderedBy(cause: Extract<LayoutChangeCause, { kind: 'exit-complete' }>): boolean {
        const element = this.element
        return cause.markers.some(
            ({ boundary, group }) =>
                (!!element && !!boundary?.contains(element)) ||
                (!!this.group && group === this.group)
        )
    }

    /**
     * Snapshot this node's descendants that sit inside `boundaries` from
     * their cached layouts and run one update pass, leaving this node's own
     * box alone (plan 015b, M1). For a `layoutDependency`-gated node inside an
     * `AnimatePresence` whose exit completed: upstream still re-renders it
     * (`AnimatePresence/index.tsx:58` → `use-presence.ts:40-43` @ v14.7.1), so
     * its descendants snapshot while its own box stays gated.
     *
     * @param boundaries The completing `AnimatePresence` containers that
     *     contain this node.
     * @returns Nothing.
     *
     * @example
     * ```ts
     * adapter.refreshLayout({ silent: true })
     * adapter.commitDescendantsWithin([boundary])
     * ```
     */
    commitDescendantsWithin(boundaries: Element[]): void {
        if (!this.element || !boundaries.length) return
        const within = (projection: ProjectionTreeNode<unknown>) => {
            const instance = projection.instance
            return instance instanceof Element && boundaries.some((b) => b.contains(instance))
        }
        const root = this.projection.root
        root?.startUpdate()
        for (const child of this.projection.children) {
            this.seedCachedSnapshotsForSubtree(child, undefined, false, within)
        }
        root?.didUpdate()
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
     * (plan 007 Step 4b-a). Otherwise the cached layout. Either is rebased
     * by any scroll since it was read (plan 015a).
     */
    private onScreenSnapshot(): Measurements | undefined {
        const target = this.projection.currentAnimation ? this.projection.target : undefined
        if (target) {
            return measurementsFromRect(
                rectFromBox(this.rebasedBox(target, this.layoutBasis)),
                this.lastLayout ?? this.projection.layout
            )
        }
        return this.rebasedMeasurements(this.lastLayout, this.lastLayoutBasis)
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
                const adapter = MotionDomProjectionAdapter.adapters.get(child)
                const layout = adapter?.lastLayout
                const boxes = layout ? [layout.layoutBox, layout.measuredBox] : []
                // Also the read-free "last seen" layout (plan 008), so a
                // following layoutId node hands off from where it now is.
                if (adapter?.latestLayoutBox) boxes.push(adapter.latestLayoutBox)
                for (const box of boxes) {
                    box.x.min += dx
                    box.x.max += dx
                    box.y.min += dy
                    box.y.max += dy
                }
                visit(child)
            }
        }
        visit(this.projection as unknown as ProjectionTreeNode)
    }

    private seedCachedSnapshotsForSubtree<Instance>(
        projection: ProjectionTreeNode<Instance>,
        rootSnapshot?: Measurements,
        acrossGroups = false,
        within?: (projection: ProjectionTreeNode<unknown>) => boolean
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
                this.seedCachedSnapshotsForSubtree(child, undefined, false, within)
            }
            return
        }
        // The committer's own snapshot comes from the caller, already
        // rebased; a cached layout is rebased here (plan 015a).
        const snapshot =
            isCommitter && rootSnapshot
                ? cloneMeasurements(rootSnapshot)
                : adapter?.rebasedMeasurements(adapter.lastLayout, adapter.lastLayoutBasis)

        // `layoutId`-only nodes are seeded too — see `commitObservedLayoutChange`.
        // A descendant that already holds a snapshot keeps it, as
        // `willUpdate()` returns early for a layout-dirty node: e.g. an
        // arriving `layoutId` node `promote()` handed a shared snapshot.
        const keepsOwn =
            (!isCommitter && (projection.isLayoutDirty || !!projection.snapshot)) ||
            (within !== undefined && !within(projection as ProjectionTreeNode<unknown>))
        if (snapshot && !keepsOwn && (projection.options.layout || projection.options.layoutId)) {
            this.prepareSnapshotPath(projection)
            projection.snapshot = snapshot
            projection.isLayoutDirty = true
        }

        for (const child of projection.children) {
            this.seedCachedSnapshotsForSubtree(child, undefined, acrossGroups, within)
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
     * The base is the user-authored `style` transform, or else the
     * VisualElement's own `transform` string when upstream's
     * `resetTransform()` would keep it (`upstreamKeptTransform`), or else
     * what upstream resets to: the `transformTemplate` value, or `'none'`
     * (create-projection-node.ts @ v14.7.1, 1046-1076). Every read the
     * adapter caches (`seedLayout`, `refreshLayout`, `measurePageRect`) runs
     * under it, so a cached box never includes the `latestValues`
     * transforms that `applyTransform` adds back (plan 015a).
     *
     * Elements whose inline transform already equals their base exactly (an
     * idle element with a user-authored transform, or one motion has settled
     * back to base) are skipped, avoiding a no-op double style write. The
     * `'' → 'none'` write is NOT skipped: an inline `none` overrides a
     * stylesheet-authored transform during the read, and that stripping is
     * part of the measurement contract.
     *
     * Motion 14.2 runs x/y/scale/rotate as one WAAPI `transform` animation, and
     * a WAAPI animation overrides the inline base transform written here, so
     * the read would include the in-flight value. Upstream only measures
     * inside a real update, after `willUpdate()` demotes Motion's own group
     * (`demoteTransforms`, create-projection-node.ts @ v14.2.0, 123-124, 707,
     * 713, 1007); svelte-motion also measures speculatively (layout
     * observers), where demoting would move every observed element off the
     * compositor. So the transform effects of an element whose OWN Motion
     * transforms are on the compositor (`hasAcceleratedMotionTransform`) are
     * detached instead: clearing `effect.target` removes the effect without
     * touching its timing, and restoring it before the next frame keeps
     * `currentTime` and `playState`, so nothing is painted detached. Any other
     * transform animation (a page's own `el.animate()`, a finished
     * `animate(el, { transform })`) stays applied, as it does upstream.
     *
     * Every element's animations are collected first, then every write
     * happens, so a chain of N elements costs one style recalculation rather
     * than one per element. Never `await` between stripping and restoring.
     *
     * @returns Restores every inline transform and detached effect.
     */
    private stripToBaseTransforms(): () => void {
        const adapters: MotionDomProjectionAdapter[] = []
        for (const node of this.projection.path) {
            const ancestor = MotionDomProjectionAdapter.adapters.get(node)
            if (ancestor?.element) adapters.push(ancestor)
        }
        if (this.element) adapters.push(this)

        // Reads: collect before any write so they share one style recalc.
        const detached: Array<[HTMLElement, KeyframeEffect]> = []
        for (const adapter of adapters) {
            if (hasAcceleratedMotionTransform(adapter.visualElement)) {
                collectTransformEffects(adapter.element!, detached)
            }
        }

        // Writes.
        for (const [, effect] of detached) effect.target = null
        const restoreList: Array<{ el: HTMLElement; prev: string }> = []
        for (const adapter of adapters) {
            const el = adapter.element!
            const prev = el.style.transform
            const userBase = adapter.getBaseTransform?.()
            // Upstream resets to the `transformTemplate` value, else `none`
            // (`resetTransform`, HTMLProjectionNode.ts:20-22 @ v14.7.1).
            const transformTemplate = adapter.visualElement.getProps().transformTemplate
            const base =
                (userBase && userBase !== 'none' ? userBase : undefined) ??
                upstreamKeptTransform(adapter.projection, adapter.visualElement) ??
                (transformTemplate
                    ? transformTemplate(adapter.projection.latestValues, '')
                    : undefined) ??
                userBase ??
                'none'
            if (prev === base) continue
            restoreList.push({ el, prev })
            el.style.transform = base
        }

        return () => {
            for (let i = restoreList.length - 1; i >= 0; i--) {
                restoreList[i].el.style.transform = restoreList[i].prev
            }
            for (let i = detached.length - 1; i >= 0; i--) {
                const [el, effect] = detached[i]
                effect.target = el
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
        this.copyLayoutToCache()
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
            // The layout the pass measured, with that read's basis.
            this.copyLayoutToCache()
        })
    }
}
