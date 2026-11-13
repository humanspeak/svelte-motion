import { createEffect as createEffectCore, MotionValueState as MotionValueStateCore } from 'motion'
import { describe, expect, it } from 'vitest'
import {
    MOTION_EXPORTS_NOT_REEXPORTED,
    MOTION_EXPORTS_PENDING_SVELTE_ADAPTATION,
    MOTION_PUBLIC_REEXPORTS
} from './__tests__/motionExportAllowlist.js'
import {
    animate,
    animateMini,
    AnimatePresence,
    type AnimationOptions,
    type AnimationPlaybackControlsWithThen,
    type AnimationSequence,
    anticipate,
    arc,
    backIn,
    backInOut,
    backOut,
    circIn,
    circInOut,
    circOut,
    clamp,
    createDragControls,
    createEffect,
    createScopedAnimate,
    cubicBezier,
    delay,
    distance,
    distance2D,
    type DOMKeyframesDefinition,
    drag,
    type DragOptions,
    easeIn,
    easeInOut,
    easeOut,
    type ElementOrSelector,
    type GeneratorFactory,
    hover,
    inertia,
    type InertiaOptions,
    interpolate,
    inView,
    type KeyframeGenerator,
    type KeyframeOptions,
    keyframes,
    mix,
    motion,
    MotionConfig,
    type MotionConfigProps,
    type MotionTransformPoint,
    MotionValueState,
    type NestedSequence,
    type ObjectTarget,
    pinch,
    pipe,
    PresenceChild,
    press,
    processFrame,
    progress,
    propEffect,
    resize,
    resolveElements,
    scopeMotion,
    scroll,
    type Segment,
    type SelectorCache,
    type SequenceInfo,
    type SequenceOptions,
    type SpringOptions,
    stagger,
    stringifyStyleObject,
    type Timeline,
    type TimelineCallback,
    type TimelineItem,
    type TimelineOptions,
    toMediaQuery,
    transform,
    useAnimate,
    useAnimationFrame,
    useCycle,
    useInView,
    useIsPresent,
    usePresence,
    usePresenceData,
    useReducedMotion,
    useScopeMotion,
    useSpring,
    useTime,
    useTransform,
    type ValueAnimationOptions,
    wrap
} from './index.js'
import { motionValue } from './utils/vanillaValues.svelte.js'

describe('public API: index.ts', () => {
    it('re-exports or deliberately skips every runtime export of motion', async () => {
        const motionExports = Object.keys(await import('motion')).sort()
        const ours = (await import('./index.js')) as Record<string, unknown>
        const unaccounted = motionExports.filter(
            (name) => !(name in ours) && !MOTION_EXPORTS_NOT_REEXPORTED.has(name)
        )
        expect(unaccounted, 'motion exports that are neither re-exported nor allowlisted').toEqual(
            []
        )
        const stale = [...MOTION_EXPORTS_NOT_REEXPORTED].filter(
            (name) => !motionExports.includes(name) || name in ours
        )
        expect(
            stale,
            'allowlist entries motion no longer exports, or that we now re-export'
        ).toEqual([])
    })

    it('re-exports Motion public API as-is (plan 014 bucket a)', async () => {
        const motionNs = (await import('motion')) as Record<string, unknown>
        const ours = (await import('./index.js')) as Record<string, unknown>
        for (const name of MOTION_PUBLIC_REEXPORTS) {
            expect(MOTION_EXPORTS_NOT_REEXPORTED.has(name), `${name} is still allowlisted`).toBe(
                false
            )
            expect(typeof motionNs[name], `motion no longer exports ${name}`).toBe('function')
            expect(ours[name], `${name} is not re-exported as motion's binding`).toBe(
                motionNs[name]
            )
        }
    })

    it('keeps names awaiting a Svelte adaptation allowlisted and unexported (plan 014 bucket d)', async () => {
        const ours = (await import('./index.js')) as Record<string, unknown>
        for (const name of MOTION_EXPORTS_PENDING_SVELTE_ADAPTATION) {
            expect(MOTION_EXPORTS_NOT_REEXPORTED.has(name), `${name} must stay allowlisted`).toBe(
                true
            )
            expect(name in ours, `${name} is exported; drop it from the pending set`).toBe(false)
        }
    })

    it('exports MotionConfig coordinate transform types', () => {
        const transformPagePoint: MotionTransformPoint = ({ x, y }) => ({ x: x * 2, y: y * 2 })
        const config: MotionConfigProps = { transformPagePoint }

        expect(config.transformPagePoint?.({ x: 10, y: 20 })).toEqual({ x: 20, y: 40 })
    })
    it('exports motion object with lowercased HTML keys', () => {
        // spot-check some common elements
        expect(motion).toBeTruthy()
        expect(typeof motion.div).toBe('function')
        expect(typeof motion.button).toBe('function')
        expect(typeof motion.img).toBe('function')

        // ensure keys are lowercase (no accidental PascalCase)
        expect((motion as unknown as Record<string, unknown>).Img).toBeUndefined()
    })

    it('re-exports animate and hover from motion', () => {
        expect(typeof animate).toBe('function')
        expect(typeof hover).toBe('function')
    })

    it('exports the vanilla drag() gesture and its DragOptions type', () => {
        const options: DragOptions = { axis: 'x', constraints: { left: 0, right: 200 } }
        expect(typeof drag).toBe('function')
        expect(options.axis).toBe('x')
    })

    it('re-exports Motion 14.5 scopeMotion, toMediaQuery and the useScopeMotion attachment', () => {
        expect(typeof scopeMotion).toBe('function')
        expect(typeof toMediaQuery).toBe('function')
        expect(typeof useScopeMotion).toBe('function')
    })

    it('re-exports Motion 14.6 processFrame', () => {
        expect(typeof processFrame).toBe('function')
    })

    it('re-exports Motion 14.11 pinch', () => {
        expect(typeof pinch).toBe('function')
    })

    it('re-exports the Motion 13.2 effect registry primitives', () => {
        expect(createEffect).toBe(createEffectCore)
        expect(MotionValueState).toBe(MotionValueStateCore)
    })

    it('keeps addEffect/removeEffect on the re-typed animate', () => {
        expect(typeof animate.addEffect).toBe('function')
        expect(typeof animate.removeEffect).toBe('function')
    })

    it('keeps .get on the re-typed propEffect', () => {
        expect(typeof propEffect.get).toBe('function')
    })

    it('exports MotionConfig component', () => {
        expect(typeof MotionConfig).toBe('function')
    })

    it('exports AnimatePresence component', () => {
        expect(typeof AnimatePresence).toBe('function')
    })

    it('exports PresenceChild component', () => {
        expect(typeof PresenceChild).toBe('function')
    })

    it('exports createDragControls factory', () => {
        expect(typeof createDragControls).toBe('function')
        const controls = createDragControls()
        expect(controls).toBeTruthy()
        expect(typeof controls.start).toBe('function')
        expect(typeof controls.cancel).toBe('function')
        expect(typeof controls.stop).toBe('function')
        expect(typeof controls.subscribe).toBe('function')
    })

    it('exports utility helpers', () => {
        expect(typeof useAnimate).toBe('function')
        expect(typeof useAnimationFrame).toBe('function')
        expect(typeof useCycle).toBe('function')
        expect(typeof useInView).toBe('function')
        expect(typeof useIsPresent).toBe('function')
        expect(typeof usePresence).toBe('function')
        expect(typeof usePresenceData).toBe('function')
        expect(typeof useReducedMotion).toBe('function')
        expect(typeof useSpring).toBe('function')
        expect(typeof stringifyStyleObject).toBe('function')
        expect(typeof useTime).toBe('function')
        expect(typeof useTransform).toBe('function')
    })

    it('re-exports core motion functions', () => {
        expect(typeof transform).toBe('function')
        expect(typeof stagger).toBe('function')
        expect(typeof inView).toBe('function')
        expect(typeof scroll).toBe('function')
        expect(typeof press).toBe('function')
        expect(typeof resize).toBe('function')
        expect(typeof delay).toBe('function')
    })

    it('re-exports easing functions', () => {
        expect(typeof anticipate).toBe('function')
        expect(typeof backIn).toBe('function')
        expect(typeof backInOut).toBe('function')
        expect(typeof backOut).toBe('function')
        expect(typeof circIn).toBe('function')
        expect(typeof circInOut).toBe('function')
        expect(typeof circOut).toBe('function')
        expect(typeof easeIn).toBe('function')
        expect(typeof easeInOut).toBe('function')
        expect(typeof easeOut).toBe('function')
        expect(typeof cubicBezier).toBe('function')
    })

    it('re-exports utility functions', () => {
        expect(typeof interpolate).toBe('function')
        expect(typeof mix).toBe('function')
        expect(typeof clamp).toBe('function')
        expect(typeof wrap).toBe('function')
        expect(typeof pipe).toBe('function')
        expect(typeof distance).toBe('function')
        expect(typeof distance2D).toBe('function')
        expect(typeof progress).toBe('function')
    })

    it('re-exports arc() path factory from motion-dom', () => {
        expect(typeof arc).toBe('function')
        const path = arc({ strength: 1 })
        expect(typeof path.animateValues).toBe('function')
        expect(typeof path.interpolateProjection).toBe('function')
    })

    it('transform creates a range mapper', () => {
        const mapper = transform([0, 100], [0, 1])
        expect(typeof mapper).toBe('function')
        expect(mapper(0)).toBe(0)
        expect(mapper(50)).toBeCloseTo(0.5)
        expect(mapper(100)).toBe(1)
    })

    it('transform clamps out-of-range inputs to the output range', () => {
        // transform clamps (does not extrapolate) when input falls outside the input range
        const mapper = transform([0, 100], [0, 1])

        // Below input range: -10 maps to 0 (clamped to output minimum)
        expect(mapper(-10)).toBe(0)

        // Above input range: 150 maps to 1 (clamped to output maximum)
        expect(mapper(150)).toBe(1)

        // Verify clamping holds for more extreme out-of-range values
        expect(mapper(-50)).toBe(0)
        expect(mapper(200)).toBe(1)
    })
})

/**
 * Compile-only: `animate` and the scoped animate from `useAnimate()` return
 * Motion 14.7's `Timeline`, and the timeline and sequence types are exported.
 */
function timelineTypeAssertions() {
    const tl: Timeline = animate([['.a', { opacity: 1 }], 'mid'], { autoplay: false })
    const item: TimelineItem = ['.b', { opacity: 0 }]
    tl.add(item, 'mid+0.5')
    const onCross: TimelineCallback = (direction) => void direction
    tl.call(onCross, 1)
    const nested: NestedSequence = { sequence: [['.c', { x: 10 }]], at: 0.5 }
    const sequence: AnimationSequence = [nested, 'end']
    const segment: Segment = sequence[0]
    const options: Omit<TimelineOptions, 'scope'> = { onReverseComplete: () => {} }
    const sequenceOptions: SequenceOptions = { duration: 1, reduceMotion: true }
    const info: SequenceInfo = { duration: 1 }
    const target: ObjectTarget<{ n: number }> = { n: 1 }
    const [, scoped] = useAnimate()
    const fromValue: Timeline = scoped(0, 100)
    // @ts-expect-error the scope comes from useAnimate(), not per call
    scoped([['.a', { opacity: 1 }]], { scope: undefined })
    void [segment, options, sequenceOptions, info, target, fromValue]
}

// Compile-time only: referenced so the checker keeps it, and lint sees a use.
void timelineTypeAssertions

/**
 * Compile-only assertions for plan 014's re-exports — never invoked. `pnpm
 * check` validates that the public types fit the re-exported functions, that
 * useAnimate's scope and augmented motion values need no cast, and that the
 * two `@ts-expect-error` lines stay errors.
 */
function plan014TypeAssertions() {
    const [scope] = useAnimate<HTMLDivElement>()
    const scoped = createScopedAnimate({ scope, reduceMotion: true, skipAnimations: false })
    const tl: Timeline = scoped(motionValue(0), 100) // augmented value, no cast
    const fromSelector: Timeline = createScopedAnimate()('.box', { opacity: 1 })
    // @ts-expect-error the scoped animate has no effect-registry statics
    void scoped.addEffect
    const options: ValueAnimationOptions<number> = { keyframes: [0], velocity: 500 }
    const gen: KeyframeGenerator<number> = inertia(options)
    const tween: KeyframeGenerator<number> = keyframes({ keyframes: [0, 1], duration: 300 })
    const factory: GeneratorFactory = inertia
    const inertiaTransition: InertiaOptions = { power: 0.5, min: 0, max: 100 }
    const tweenTransition: KeyframeOptions = { ease: 'linear', times: [0, 1] }
    const springTransition: SpringOptions = { stiffness: 300, damping: 20 }
    const target: ElementOrSelector = '.box'
    const cache: SelectorCache = {}
    const els: Element[] = resolveElements(target, scope, cache)
    const kf: DOMKeyframesDefinition = { opacity: [0, 1] }
    const opts: AnimationOptions = { duration: 0.2 }
    const mini: AnimationPlaybackControlsWithThen = animateMini('.box', kf, opts)
    // @ts-expect-error animateMini animates elements only, not motion values
    animateMini(motionValue(0), { opacity: 1 })
    void [
        tl,
        fromSelector,
        gen,
        tween,
        factory,
        inertiaTransition,
        tweenTransition,
        springTransition,
        els,
        mini
    ]
}
void plan014TypeAssertions
