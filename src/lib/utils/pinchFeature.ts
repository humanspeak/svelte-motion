import {
    addPinchListeners,
    Feature,
    getFeatureDefinitions,
    setFeatureDefinitions,
    type MotionNodeOptions,
    type OnPinchEvent,
    type PinchProps,
    type PinchValues,
    type VisualElement
} from 'motion-dom'

/**
 * The motion values a pinch drives, in the order `addPinchListeners` expects.
 */
const valueKeys = ['scale', 'rotate', 'x', 'y'] as const

/**
 * The pinch feature: scales, rotates and moves an element with two touches,
 * a trackpad pinch or Safari's gesture events, through motion-dom's
 * `addPinchListeners`.
 *
 * Port of `framer-motion/src/gestures/pinch.ts` (v14.12.0). Shipped only in
 * the opt-in `pinchFeatures` bundle and registered by
 * {@link loadPinchFeature}; enabled by {@link isPinchFeatureEnabled}.
 *
 * Two documented Svelte deviations (re-check both on each Motion bump):
 *
 * 1. The feature can be instantiated by a props-sync pass before the
 *    VisualElement has an instance, in which case there is no element to
 *    bind. Attachment is idempotent and retried on the next `update()`, as
 *    `DragGestureFeature` does.
 * 2. Upstream's `mount()`/`update()` write `element.style.touchAction`. Here
 *    Svelte owns the `style` attribute and rewrites it whenever the inline
 *    style string changes, which would erase that write (and a value captured
 *    at mount would restore a stale one). So this feature never touches
 *    `touchAction`; `_MotionContainer.svelte` appends `touch-action` to the
 *    inline style declaratively, using {@link resolvePinchTouchAction}.
 *
 * @example
 * ```ts
 * loadPinchFeature({ Feature: PinchGestureFeature as never, isEnabled: isPinchFeatureEnabled })
 * ```
 */
export class PinchGestureFeature extends Feature<Element> {
    private removeListeners: VoidFunction | null = null

    /**
     * @param node VisualElement this feature is attached to.
     */
    constructor(node: VisualElement<Element>) {
        super(node)
    }

    /**
     * Attach the pinch listeners once the element exists (Svelte deviation 1).
     *
     * @returns Nothing.
     */
    private attach(): void {
        const { current } = this.node
        if (this.removeListeners || !current) return

        /**
         * The latest enabled options. addPinchListeners reads them before
         * each step of a gesture, so they're current when a callback runs,
         * and a pinch disabled mid-way still calls its `onEnd`.
         */
        let options: PinchProps = {}

        /**
         * Call the prop's `onStart`, `onMove` or `onEnd`, so each can
         * change mid-gesture.
         */
        const call =
            (key: 'onStart' | 'onMove' | 'onEnd'): OnPinchEvent =>
            (event, info) =>
                options[key]?.(event, info)

        this.removeListeners = addPinchListeners(
            current,
            () =>
                valueKeys.map((key) =>
                    this.node.getValue(key, key === 'scale' ? 1 : 0)
                ) as unknown as PinchValues,
            () => {
                const { pinch } = this.node.getProps()
                return pinch && (options = pinch === true ? {} : pinch)
            },
            (_element, event, info) => {
                // `void`: the gesture never waits on the whilePinch animation.
                const setActive = (isActive: boolean): void => {
                    void this.node.animationState?.setActive('whilePinch', isActive)
                }

                setActive(true)
                call('onStart')(event, info)

                return {
                    onPinch: call('onMove'),
                    onComplete: (event, info) => {
                        setActive(false)
                        call('onEnd')(event, info)
                    }
                }
            }
        )
    }

    /**
     * Attach the pinch listeners.
     *
     * @returns Nothing.
     */
    mount(): void {
        this.attach()
    }

    /**
     * Retry listener attachment when the instance wasn't ready at mount
     * (Svelte deviation 1). Options and callbacks need no work here: they are
     * read from the latest props at each step of a gesture.
     *
     * @returns Nothing.
     */
    update(): void {
        this.attach()
    }

    /**
     * Remove the pinch listeners.
     *
     * @returns Nothing.
     */
    unmount(): void {
        this.removeListeners?.()
        this.removeListeners = null
    }
}

/**
 * Whether the pinch feature applies to a set of motion props.
 *
 * Port of `framer-motion/src/render/dom/features-pinch.ts` (v14.12.0)
 * `isEnabled`.
 *
 * @param props Motion node props.
 * @returns `true` when `pinch` is `true` or an options object.
 *
 * @example
 * ```ts
 * isPinchFeatureEnabled({ pinch: true }) // true
 * isPinchFeatureEnabled({ pinch: false }) // false
 * ```
 */
export const isPinchFeatureEnabled = (props: MotionNodeOptions): boolean => !!props.pinch

/**
 * A feature definition for motion-dom's `pinch` registry entry.
 *
 * motion-dom does not export its `FeatureDefinitions` type, so this is read
 * off `getFeatureDefinitions()`.
 */
export type PinchFeatureDefinition = NonNullable<ReturnType<typeof getFeatureDefinitions>['pinch']>

/**
 * Register the pinch feature in motion-dom's global feature registry, keeping
 * every other entry. Called by `<LazyMotion>` when it publishes a bundle that
 * carries `pinchFeatures` (upstream `loadFeatures`). Idempotent.
 *
 * @param definition The bundle's `pinch` feature definition.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * loadPinchFeature(pinchFeatures.pinch!)
 * ```
 */
export const loadPinchFeature = (definition: PinchFeatureDefinition): void => {
    if (getFeatureDefinitions().pinch === definition) return
    setFeatureDefinitions({ ...getFeatureDefinitions(), pinch: definition })
}

const touchActionPattern = /(?:^|;)\s*touch-action\s*:\s*([^;]+)/i

/**
 * The `touch-action` a pinchable element renders: the one the user's `style`
 * prop sets, otherwise `'none'`, so touches don't pan or zoom the page.
 *
 * Mirrors upstream `PinchGesture.update()` (`gestures/pinch.ts` @ v14.12.0),
 * `props?.touchAction || "none"`, for both of svelte-motion's style shapes.
 *
 * @param style The `style` prop: a CSS string, a style object, or undefined.
 * @returns The `touch-action` value to render.
 *
 * @example
 * ```ts
 * resolvePinchTouchAction(undefined) // 'none'
 * resolvePinchTouchAction('touch-action: pan-y') // 'pan-y'
 * resolvePinchTouchAction({ touchAction: 'pan-x' }) // 'pan-x'
 * ```
 */
export const resolvePinchTouchAction = (
    style: string | Record<string, unknown> | undefined
): string => {
    if (typeof style === 'string') {
        return style.match(touchActionPattern)?.[1].trim() || 'none'
    }
    if (style) {
        const value = style.touchAction ?? style['touch-action']
        if (typeof value === 'string' && value) return value
    }
    return 'none'
}
