import {
    HTMLProjectionNode,
    HTMLVisualElement,
    copyBoxInto,
    createBox,
    visualElementStore,
    type IProjectionNode,
    type Measurements,
    type ResolvedValues,
    type Transition,
    type VisualElement
} from 'motion-dom'

type ProjectionVisualElement = VisualElement & {
    latestValues: ResolvedValues
    projection?: IProjectionNode<HTMLElement>
}

type LayoutOption = boolean | string | undefined
type AnimationType = 'position' | 'x' | 'y' | 'size' | 'both' | 'preserve-aspect'

export interface MotionDomProjectionOptions {
    /** Parent adapter used to connect this node into the upstream projection tree. */
    parent?: MotionDomProjectionAdapter | null
}

/**
 * Latest layout-related motion props applied to an upstream projection node.
 */
export interface MotionDomProjectionUpdateOptions {
    /** Enables layout projection and selects the upstream animation type. */
    layout?: LayoutOption
    /** Shared layout id used by upstream projection matching. */
    layoutId?: string
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
    readonly visualElement: ProjectionVisualElement
    readonly projection: IProjectionNode<HTMLElement>

    private element: HTMLElement | null = null
    private layout: LayoutOption
    private layoutId: string | undefined
    private transition: Transition | undefined
    private lastLayout: Measurements | undefined

    constructor(options: MotionDomProjectionOptions = {}) {
        const parent = options.parent ?? null
        this.visualElement = new HTMLVisualElement(
            {
                parent: parent?.visualElement,
                props: {},
                presenceContext: null,
                visualState: createVisualState()
            } as never,
            { allowProjection: true } as never
        ) as ProjectionVisualElement
        this.projection = new HTMLProjectionNode(
            this.visualElement.latestValues,
            parent?.projection as unknown as IProjectionNode | undefined
        )
        this.visualElement.projection = this.projection
    }

    /**
     * Update projection options from current Svelte props.
     *
     * @param options Current layout-related motion props.
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
            animationType: animationTypeForLayout(options.layout),
            transition: options.transition,
            visualElement: this.visualElement
        })
    }

    /**
     * Mount the upstream projection node to an element and seed its layout.
     *
     * @param element Element represented by the current motion component.
     */
    mount(element: HTMLElement): void {
        if (this.element === element) return
        if (this.element) this.unmount()

        this.element = element
        this.visualElement.mount(element)
        this.seedLayout()
    }

    /**
     * Unmount the upstream projection node and clear its visual-element store.
     */
    unmount(): void {
        if (!this.element) return
        const element = this.element
        this.projection.scheduleCheckAfterUnmount()
        this.visualElement.unmount()
        visualElementStore.delete(element)
        this.element = null
        this.lastLayout = undefined
    }

    /**
     * Capture the upstream "before" snapshot.
     */
    willUpdate(): void {
        if (!this.element || !this.layoutId) return
        this.projection.willUpdate()
    }

    /**
     * Commit an upstream layout update after Svelte has patched the DOM.
     */
    didUpdate(): void {
        if (!this.element || !this.layoutId) return
        this.projection.root?.didUpdate()
        this.refreshCachedLayout()
    }

    /**
     * Seed the current layout without animating.
     */
    seedLayout(): void {
        if (!this.element) return
        this.projection.isLayoutDirty = true
        this.projection.updateLayout()
        this.lastLayout = cloneMeasurements(this.projection.layout)
    }

    /**
     * Animate from the last cached layout to the current observed layout.
     *
     * This covers layout changes discovered after the mutation by observers.
     * Svelte runes mode doesn't expose the same component pre/post-update
     * hooks Framer Motion uses in React, so this adapter reuses upstream
     * projection while the Svelte component controls the snapshot timing.
     */
    commitObservedLayoutChange(): void {
        if (!this.element || !this.layoutId) return
        const snapshot = cloneMeasurements(this.lastLayout)
        if (!snapshot) {
            this.seedLayout()
            return
        }

        this.projection.root?.startUpdate()
        this.projection.snapshot = snapshot
        this.projection.isLayoutDirty = true
        this.projection.root?.didUpdate()
        this.refreshCachedLayout()
    }

    private refreshCachedLayout(): void {
        requestAnimationFrame(() => {
            this.lastLayout = cloneMeasurements(this.projection.layout)
        })
    }
}
