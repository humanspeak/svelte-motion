import {
    HTMLVisualElement,
    SVGVisualElement,
    getFeatureDefinitions,
    scrapeHTMLMotionValuesFromProps,
    visualElementStore,
    type MotionNodeOptions
} from 'motion-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import {
    createMotionVisualElement,
    createRenderState,
    isAnimationFeatureEnabled,
    makeLatestValues,
    registerMotionFeatures
} from './visualElementCore.js'

/**
 * motion-dom VisualElement foundation (#449, plan 001).
 *
 * `makeLatestValues` is the port of framer-motion's
 * `use-visual-state.ts:60-132` — the values a VisualElement starts life
 * holding. `createMotionVisualElement` is the single-VisualElement-per-element
 * factory; the store-identity tests below are the invariant that keeps two
 * VisualElements from ever fighting over one DOM node.
 */

/** `makeLatestValues` with the HTML scraper and no presence/variant context. */
const latest = (props: MotionNodeOptions, context = {}) =>
    makeLatestValues(props, context, null, scrapeHTMLMotionValuesFromProps)

describe('makeLatestValues', () => {
    it('copies an object `initial` target', () => {
        expect(latest({ initial: { opacity: 0, x: -20 } })).toEqual({ opacity: 0, x: -20 })
    })

    it('takes keyframe index 0 from an `initial` keyframe array', () => {
        expect(latest({ initial: { opacity: [0.2, 0.6, 1] } })).toEqual({ opacity: 0.2 })
    })

    it('takes the LAST keyframe of `animate` when `initial` is false', () => {
        // initial === false blocks the initial animation, so we initialise at
        // the END of that blocked animation (upstream use-visual-state.ts:110).
        expect(latest({ initial: false, animate: { opacity: [0, 0.5, 1] } })).toEqual({
            opacity: 1
        })
    })

    it('resolves from `animate` when `initial` is false', () => {
        expect(latest({ initial: false, animate: { opacity: 1, scale: 2 } })).toEqual({
            opacity: 1,
            scale: 2
        })
    })

    it('resolves a variant-label `initial` against the `variants` map', () => {
        expect(
            latest({
                initial: 'hidden',
                variants: { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }
            })
        ).toEqual({ opacity: 0, y: 10 })
    })

    it('applies `transitionEnd` over the resolved target', () => {
        expect(
            latest({
                initial: 'hidden',
                variants: { hidden: { opacity: 0, transitionEnd: { display: 'none' } } }
            })
        ).toEqual({ opacity: 0, display: 'none' })
    })

    it('resolves a list of `initial` labels in order', () => {
        expect(
            latest({
                initial: ['a', 'b'],
                variants: { a: { opacity: 0, x: 5 }, b: { x: 50 } }
            })
        ).toEqual({ opacity: 0, x: 50 })
    })

    it('skips a null keyframe value (wildcard) rather than writing null', () => {
        // `null` is svelte-motion's wildcard channel ("keep the current
        // value"); it must never be written into latestValues as a literal.
        // Upstream MotionNodeOptions has no null channel; svelte-motion's own
        // public types legalize it (#453), hence the cast here.
        expect(latest({ initial: false, animate: { opacity: 1, x: null } as never })).toEqual({
            opacity: 1
        })
    })

    it('inherits the parent `initial` label for a non-controlling variant node', () => {
        // `variants` present but no variant label of its own → isVariantNode
        // true, isControllingVariants false (motion-dom
        // is-controlling-variants.mjs), so the parent's label applies.
        expect(
            latest(
                { variants: { hidden: { opacity: 0 }, visible: { opacity: 1 } } },
                {
                    initial: 'hidden'
                }
            )
        ).toEqual({ opacity: 0 })
    })

    it('does NOT inherit the parent label when the node controls its own variants', () => {
        expect(
            latest(
                { animate: 'visible', variants: { hidden: { opacity: 0 } } },
                {
                    initial: 'hidden'
                }
            )
        ).toEqual({})
    })

    it('honours a blocked initial animation from the presence context', () => {
        // presenceContext.initial === false blocks the initial animation the
        // same way `initial: false` does.
        expect(
            makeLatestValues(
                { initial: { opacity: 0 }, animate: { opacity: [0, 1] } },
                {},
                { initial: false } as never,
                scrapeHTMLMotionValuesFromProps
            )
        ).toEqual({ opacity: 1 })
    })
})

describe('createRenderState', () => {
    it('builds the HTML render-state buffers', () => {
        expect(createRenderState(false)).toEqual({
            style: {},
            transform: {},
            transformOrigin: {},
            vars: {}
        })
    })

    it('adds the `attrs` buffer for SVG', () => {
        expect(createRenderState(true)).toEqual({
            style: {},
            transform: {},
            transformOrigin: {},
            vars: {},
            attrs: {}
        })
    })
})

describe('isAnimationFeatureEnabled', () => {
    it('is false with no animation props', () => {
        expect(isAnimationFeatureEnabled({})).toBe(false)
        expect(isAnimationFeatureEnabled({ layout: true })).toBe(false)
    })

    it.each(['animate', 'variants', 'whileHover', 'whileTap', 'exit', 'whileInView', 'whileFocus'])(
        'is true for `%s`',
        (prop) => {
            expect(isAnimationFeatureEnabled({ [prop]: {} })).toBe(true)
        }
    )
})

describe('registerMotionFeatures', () => {
    it('registers the animation feature exactly once across repeat calls', () => {
        registerMotionFeatures()
        const first = getFeatureDefinitions().animation
        expect(first).toBeDefined()
        expect(first!.Feature).toBeDefined()

        registerMotionFeatures()
        // Identity, not just presence: a second registration must not clobber
        // the global registry (LazyMotion mounts many components).
        expect(getFeatureDefinitions().animation).toBe(first)
    })
})

describe('createMotionVisualElement', () => {
    let element: HTMLElement

    beforeEach(() => {
        element = document.createElement('div')
    })

    it('creates an HTMLVisualElement by default and an SVGVisualElement for SVG', () => {
        expect(createMotionVisualElement({ props: {} })).toBeInstanceOf(HTMLVisualElement)
        expect(createMotionVisualElement({ props: {}, isSVG: true })).toBeInstanceOf(
            SVGVisualElement
        )
    })

    it('seeds latestValues from the props', () => {
        const ve = createMotionVisualElement({ props: { initial: { opacity: 0 } } })
        expect(ve.latestValues).toEqual({ opacity: 0 })
    })

    it('registers itself in visualElementStore on mount and constructs the animation feature', () => {
        const ve = createMotionVisualElement({ props: { animate: { opacity: 1 } } })
        expect(ve.animationState).toBeUndefined()

        ve.mount(element)
        expect(visualElementStore.get(element)).toBe(ve)
        // motion-dom never calls updateFeatures() itself — the consumer does,
        // after mount (upstream use-visual-element.ts:147). That call is what
        // instantiates the enabled features.
        ve.updateFeatures()
        expect(ve.animationState).toBeDefined()

        ve.unmount()
        visualElementStore.delete(element)
        expect(visualElementStore.get(element)).toBeUndefined()
    })

    it('does NOT construct the animation feature without animation props', () => {
        const ve = createMotionVisualElement({ props: { layout: true } })
        ve.mount(element)
        ve.updateFeatures()
        expect(ve.animationState).toBeUndefined()
        ve.unmount()
        visualElementStore.delete(element)
    })

    it('links the parent VisualElement so the tree is connected', () => {
        const parent = createMotionVisualElement({ props: {} })
        const child = createMotionVisualElement({ props: {}, parent })
        const parentElement = document.createElement('div')
        parent.mount(parentElement)
        child.mount(element)

        expect(child.parent).toBe(parent)
        expect(parent.children.has(child)).toBe(true)

        child.unmount()
        parent.unmount()
        visualElementStore.delete(element)
        visualElementStore.delete(parentElement)
    })
})
