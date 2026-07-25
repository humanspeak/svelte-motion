import {
    HTMLVisualElement,
    SVGVisualElement,
    getFeatureDefinitions,
    scrapeHTMLMotionValuesFromProps,
    visualElementStore,
    type MotionNodeOptions
} from 'motion-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MotionDomProjectionAdapter } from './motionDomProjection.js'
import {
    ExitAnimationFeature,
    createMotionVisualElement,
    createRenderState,
    isAnimationFeatureEnabled,
    isExitFeatureEnabled,
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

describe('isExitFeatureEnabled', () => {
    it('is true only when an `exit` definition is present', () => {
        expect(isExitFeatureEnabled({})).toBe(false)
        expect(isExitFeatureEnabled({ animate: {} })).toBe(false)
        expect(isExitFeatureEnabled({ exit: { opacity: 0 } })).toBe(true)
    })
})

describe('ExitAnimationFeature', () => {
    /** A mounted VE with an `exit` prop and a spied animationState. */
    const mountWithExit = (presence: Record<string, unknown> | null) => {
        const element = document.createElement('div')
        const ve = createMotionVisualElement({
            props: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
            presenceContext: presence as never
        })
        ve.mount(element)
        ve.updateFeatures()
        const setActive = vi
            .spyOn(ve.animationState!, 'setActive')
            .mockImplementation(() => Promise.resolve())
        const animateChanges = vi
            .spyOn(ve.animationState!, 'animateChanges')
            .mockImplementation(() => Promise.resolve())
        const reset = vi.spyOn(ve.animationState!, 'reset')
        return { element, ve, setActive, animateChanges, reset }
    }

    it('registers with the presence context on mount and reports the previous occupant', () => {
        const onExitComplete = vi.fn()
        const unregister = vi.fn()
        const register = vi.fn(() => unregister)
        const { ve, element } = mountWithExit({
            id: 'p1',
            isPresent: true,
            register,
            onExitComplete
        })

        // Upstream `exit.ts:74-84`: report completion for whoever held this id,
        // then register and keep the unregister as the feature's unmount.
        expect(onExitComplete).toHaveBeenCalledTimes(1)
        expect(register).toHaveBeenCalledTimes(1)
        expect(typeof register.mock.results[0].value).toBe('function')

        ve.unmount()
        expect(unregister).toHaveBeenCalledTimes(1)
        visualElementStore.delete(element)
    })

    it('drives setActive("exit", true) when presence flips to absent, then reports completion', async () => {
        const onExitComplete = vi.fn()
        const { ve, element, setActive } = mountWithExit({
            id: 'p1',
            isPresent: true,
            register: () => () => {},
            onExitComplete
        })
        onExitComplete.mockClear()

        ve.update(ve.getProps(), {
            id: 'p1',
            isPresent: false,
            register: () => () => {},
            onExitComplete
        })
        ve.updateFeatures()

        expect(setActive).toHaveBeenCalledWith('exit', true)
        // Completion is reported only after the exit animation resolves.
        await Promise.resolve()
        await Promise.resolve()
        expect(onExitComplete).toHaveBeenCalledTimes(1)

        ve.unmount()
        visualElementStore.delete(element)
    })

    it('resets and replays the enter when re-entering after a COMPLETED exit', async () => {
        const onExitComplete = vi.fn()
        const present = {
            id: 'p1',
            isPresent: true,
            register: () => () => {},
            onExitComplete
        }
        const { ve, element, setActive, animateChanges, reset } = mountWithExit(present)

        // Give `opacity` a live MotionValue sitting at the EXIT target, which is
        // where a completed exit leaves it. `animateChanges` is mocked here, so
        // nothing else would create one, and upstream only rewinds values that
        // already exist (`getValue(key)?.jump(...)`).
        ve.getValue('opacity', 0)?.jump(0.87)
        expect(ve.getValue('opacity')?.get()).toBe(0.87)

        // Leave, and let the exit promise settle so `isExitComplete` is set.
        ve.update(ve.getProps(), { ...present, isPresent: false })
        ve.updateFeatures()
        await Promise.resolve()
        await Promise.resolve()

        setActive.mockClear()
        animateChanges.mockClear()

        // Re-enter.
        ve.update(ve.getProps(), { ...present, isPresent: true })
        ve.updateFeatures()

        // Values rewound to the resolved `initial`, state reset, enter replayed
        // (upstream `exit.ts:19-56`).
        expect(ve.getValue('opacity')?.get()).toBe(0)
        expect(reset).toHaveBeenCalled()
        expect(animateChanges).toHaveBeenCalled()

        ve.unmount()
        visualElementStore.delete(element)
    })

    it('only deactivates exit when re-entering MID-exit (no reset, no replay)', () => {
        const present = {
            id: 'p1',
            isPresent: true,
            register: () => () => {},
            onExitComplete: undefined
        }
        const { ve, element, setActive, animateChanges, reset } = mountWithExit(present)

        // Leave, but do NOT let the exit complete (no onExitComplete wired, so
        // `isExitComplete` never flips).
        ve.update(ve.getProps(), { ...present, isPresent: false })
        ve.updateFeatures()
        setActive.mockClear()
        reset.mockClear()
        animateChanges.mockClear()

        ve.update(ve.getProps(), { ...present, isPresent: true })
        ve.updateFeatures()

        expect(setActive).toHaveBeenCalledWith('exit', false)
        expect(reset).not.toHaveBeenCalled()
        expect(animateChanges).not.toHaveBeenCalled()

        ve.unmount()
        visualElementStore.delete(element)
    })

    it('is inert without a presence context', () => {
        const { ve, element, setActive } = mountWithExit(null)
        ve.update(ve.getProps(), null)
        ve.updateFeatures()
        expect(setActive).not.toHaveBeenCalled()
        ve.unmount()
        visualElementStore.delete(element)
    })

    it('is registered in the feature registry under `exit`', () => {
        registerMotionFeatures()
        const definitions = getFeatureDefinitions()
        expect(definitions.exit).toBeDefined()
        expect(definitions.exit!.Feature).toBe(ExitAnimationFeature)
        expect(definitions.exit!.isEnabled({ exit: {} })).toBe(true)
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

    it('starts with EMPTY latestValues when seeding is opted out', () => {
        // The projection node holds `latestValues` by reference and reads its
        // transform keys as transforms already applied to the element, so a
        // node that does not render yet must not advertise a target it never
        // wrote (#449 plan 001 inertness).
        const ve = createMotionVisualElement({
            props: { initial: { opacity: 0, scale: 0.5 } },
            seedLatestValues: false
        })
        expect(ve.latestValues).toEqual({})
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

    it('keeps exactly ONE VisualElement in the store when a projection adapter shares the element', () => {
        // The single-VisualElement invariant: the container owns the node and
        // injects it into the projection adapter, so `visualElementStore` maps
        // the element to that one instance — never to a second node that would
        // double-render it.
        const ve = createMotionVisualElement({ props: { animate: { opacity: 1 } } })
        const adapter = new MotionDomProjectionAdapter({ visualElement: ve })
        adapter.updateOptions({ layout: true })

        adapter.mount(element)
        ve.mount(element)
        ve.updateFeatures()

        expect(adapter.visualElement).toBe(ve)
        expect(visualElementStore.get(element)).toBe(ve)

        adapter.unmount()
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
