import type { GestureCoordinator } from '$lib/utils/gestureCoordinator'
import {
    buildGestureTransform,
    collectGestureTransformValues,
    splitGestureTransformValues,
    type GestureTransformValues
} from '$lib/utils/transformComposer'
import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'
import {
    animateValue,
    getDefaultTransition,
    hover,
    mixNumber,
    type TransformTemplate
} from 'motion-dom'

/**
 * Determine whether the current environment supports true hover.
 *
 * Uses `(hover: hover)` and `(pointer: fine)` media queries to avoid sticky
 * hover states on touch devices.
 *
 * @param win Window object (useful for testing/mocking).
 * @return Whether the device supports hover with a fine pointer.
 */
export const isHoverCapable = (win: Window = window): boolean => {
    try {
        const mqHover = win.matchMedia('(hover: hover)')
        const mqPointerFine = win.matchMedia('(pointer: fine)')
        return mqHover.matches && mqPointerFine.matches
    } catch {
        return false
    }
}

/**
 * Split a hover definition into keyframes and an optional nested transition.
 *
 * @param def While-hover record that may include a nested `transition`.
 * @return Object with `keyframes` (no `transition`) and optional `transition`.
 */
export const splitHoverDefinition = (
    def: Record<string, unknown>
): {
    keyframes: Record<string, unknown>
    transition?: AnimationOptions
} => {
    const { transition, ...rest } = (def ?? {}) as { transition?: AnimationOptions }
    return { keyframes: rest, transition }
}

/**
 * Read the element's current uniform scale from its computed transform —
 * the VISUAL value, regardless of which system last wrote it.
 *
 * @param el Target element.
 * @returns The rendered scale factor (1 when untransformed).
 * @example
 * ```ts
 * const from = readTransformScale(el) // seed a continuous animation
 * ```
 */
export const readTransformScale = (el: HTMLElement): number => {
    const transform = getComputedStyle(el).transform
    if (!transform || transform === 'none') return 1
    const matrix = transform.match(/matrix\(([^)]+)\)/)
    if (!matrix) return 1

    const [a, b] = matrix[1].split(',').map((part) => Number.parseFloat(part.trim()))
    if (!Number.isFinite(a)) return 1
    if (!Number.isFinite(b)) return a
    return Math.hypot(a, b)
}

const getFinalNumber = (value: unknown): number | null => {
    const raw: unknown = Array.isArray(value) ? value[value.length - 1] : value
    const parsed = typeof raw === 'number' ? raw : Number.parseFloat(String(raw))
    return Number.isFinite(parsed) ? parsed : null
}

/**
 * Parse a scalar CSS value into its numeric part and unit suffix.
 *
 * Numbers report an empty unit; unit strings like `'-50%'` or `'2rem'` report
 * their suffix so callers can decide whether two values share a unit and may be
 * safely interpolated. Anything that isn't a finite number-with-unit (colors,
 * `var(...)`, arrays) returns `null`.
 *
 * @param value Candidate channel value (number or string).
 * @return `{ value, unit }` when parseable, otherwise `null`.
 * @example
 * parseUnitValue('-50%') // => { value: -50, unit: '%' }
 * parseUnitValue(8)      // => { value: 8, unit: '' }
 * parseUnitValue('red')  // => null
 */
export const parseUnitValue = (value: unknown): { value: number; unit: string } | null => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? { value, unit: '' } : null
    }
    if (typeof value !== 'string') return null
    const match = value.trim().match(/^(-?\d*\.?\d+)([a-z%]*)$/i)
    if (!match) return null
    const parsed = Number.parseFloat(match[1])
    return Number.isFinite(parsed) ? { value: parsed, unit: match[2] } : null
}

const toMillisecondsTransition = (
    transition: AnimationOptions | undefined
): Record<string, unknown> => {
    const valueTransition = { ...((transition ?? {}) as Record<string, unknown>) }
    for (const key of ['duration', 'delay', 'repeatDelay']) {
        if (typeof valueTransition[key] === 'number') {
            valueTransition[key] = valueTransition[key] * 1000
        }
    }
    return valueTransition
}

/**
 * Compute the baseline values to restore to on hover end.
 *
 * Preference order per key: `animate` → `initial` → style-authored base values
 * → neutral transform defaults → computed style value if present.
 *
 * @param el Target element.
 * @param opts Source records for baseline computation. `baseValues` carries
 * style-authored transform channels, which this function cannot read from the
 * element itself; without them a style-authored channel (e.g. rotate) would
 * neutral-default and the gesture would settle to neutral, then snap once the
 * authored style repaints.
 * @return Minimal baseline record to restore on hover end.
 */
export const computeHoverBaseline = (
    el: HTMLElement,
    opts: {
        initial?: Record<string, unknown>
        animate?: Record<string, unknown>
        whileHover?: Record<string, unknown>
        baseValues?: Record<string, unknown>
    }
): Record<string, unknown> => {
    const baseline: Record<string, unknown> = {}
    const initialRecord = opts.initial ?? {}
    const animateRecord = opts.animate ?? {}
    const baseValuesRecord = opts.baseValues ?? {}
    const whileHoverRecordRaw = opts.whileHover ?? {}
    const whileHoverRecord = { ...whileHoverRecordRaw } as Record<string, unknown>
    delete whileHoverRecord.transition

    const neutralTransformDefaults: Record<string, unknown> = {
        x: 0,
        y: 0,
        translateX: 0,
        translateY: 0,
        scale: 1,
        scaleX: 1,
        scaleY: 1,
        rotate: 0,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,
        skewX: 0,
        skewY: 0,
        opacity: 1
    }

    const cs = getComputedStyle(el)
    const inlineStyle = el.getAttribute('style') || ''

    // Helper to escape regex metacharacters to prevent ReDoS and ensure literal matching
    const escapeRegExp = (str: string): string => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    // Helper to extract CSS function (var, calc, min, max, etc.) from inline style if present
    const getInlineStyleValue = (propName: string): string | null => {
        const kebabCase = propName.replace(/([A-Z])/g, '-$1').toLowerCase()
        const escapedKebabCase = escapeRegExp(kebabCase)
        // Match property name at start of string or after semicolon
        const regex = new RegExp(`(?:^|;)\\s*${escapedKebabCase}\\s*:\\s*([^;]+)`, 'i')
        const match = inlineStyle.match(regex)
        if (match) {
            const value = match[1].trim()
            // Preserve CSS functions: var(), calc(), min(), max(), clamp(), rgb(), hsl(), url(), etc.
            if (/\b(var|calc|min|max|clamp|rgb|rgba|hsl|hsla|url)\s*\(/.test(value)) {
                return value
            }
        }
        return null
    }

    for (const key of Object.keys(whileHoverRecord)) {
        if (Object.prototype.hasOwnProperty.call(animateRecord, key)) {
            baseline[key] = animateRecord[key]
        } else if (Object.prototype.hasOwnProperty.call(initialRecord, key)) {
            baseline[key] = initialRecord[key]
        } else if (baseValuesRecord[key] !== undefined) {
            baseline[key] = baseValuesRecord[key]
        } else if (key in neutralTransformDefaults) {
            baseline[key] = neutralTransformDefaults[key]
        } else {
            // Check if inline style has a CSS variable for this property
            const inlineValue = getInlineStyleValue(key)
            if (inlineValue) {
                baseline[key] = inlineValue
            } else if (key in (cs as unknown as Record<string, unknown>)) {
                baseline[key] = (cs as unknown as Record<string, unknown>)[key]
            }
        }
    }
    return baseline
}

type HoverTransformComposerOptions = {
    getBaseTransformValues?: () => GestureTransformValues
    getLiveTransformValues?: () => GestureTransformValues | null
    getBaseTransform?: () => string
    transformTemplate?: TransformTemplate
}

/**
 * Attach whileHover interactions to an element with capability gating.
 *
 * Uses motion-dom's hover function which filters out touch events and interoperates
 * with drag gestures. On pointer enter, animates to `whileHover` (using nested `transition`
 * if provided). On leave, restores changed keys to the baseline using the merged
 * root/component transition.
 *
 * @param el Target element.
 * @param whileHover While-hover definition.
 * @param mergedTransition Root/component merged transition.
 * @param callbacks Optional lifecycle callbacks for hover start/end.
 * @param baselineSources Optional sources used to compute baseline.
 * @param transformComposer Optional shared transform sources used by scale animation.
 * @param coordinator Optional shared gesture coordinator. When provided, hover
 * activity is tracked as state (upstream `setActive` semantics), hover yields
 * its keys while a higher-priority tap is active (upstream protected keys),
 * and every animation start stops other in-flight gesture writers first.
 * @return Cleanup function to remove hover listeners.
 */
export const attachWhileHover = (
    el: HTMLElement,
    whileHover: Record<string, unknown> | undefined,
    mergedTransition: AnimationOptions,
    callbacks?: { onStart?: () => void; onEnd?: () => void },
    baselineSources?: { initial?: Record<string, unknown>; animate?: Record<string, unknown> },
    transformComposer?: HoverTransformComposerOptions,
    coordinator?: GestureCoordinator
): (() => void) => {
    if (!whileHover) return () => {}

    let hoverBaseline: Record<string, unknown> | null = null
    let fallbackBaseTransform = ''
    const restingTransformValues: GestureTransformValues = {
        ...collectGestureTransformValues(baselineSources?.initial),
        ...collectGestureTransformValues(baselineSources?.animate)
    }

    // Channels the composed writer currently owns, plus their in-flight
    // animations. Whenever the composed writer engages it must own EVERY
    // transform channel the gesture animates — a second (native) writer on
    // `el.style.transform` would clobber it frame by frame.
    const liveChannelValues: GestureTransformValues = {}
    const channelAnimations = new Map<string, { stop?: () => void }>()

    const writeComposedChannels = () => {
        const transform =
            buildGestureTransform(
                {
                    ...(transformComposer?.getBaseTransformValues?.() ?? {}),
                    ...restingTransformValues,
                    ...(transformComposer?.getLiveTransformValues?.() ?? {}),
                    ...liveChannelValues
                },
                transformComposer?.getBaseTransform?.() ?? fallbackBaseTransform,
                transformComposer?.transformTemplate
            ) || 'none'
        el.style.transform = transform
        // Motion's internal motion-values can't see this direct style write;
        // flag each owned channel so the next motion element animation on it
        // seeds from the visual value instead of snapping to the stale one.
        for (const key of Object.keys(liveChannelValues)) {
            coordinator?.markExternalWrite(key)
        }
    }

    const stopChannelAnimations = () => {
        for (const animation of channelAnimations.values()) animation.stop?.()
        channelAnimations.clear()
    }

    const readChannelStart = (key: string): number => {
        if (key === 'scale') return readTransformScale(el)
        const live = liveChannelValues[key]
        if (typeof live === 'number') return live
        const resting = restingTransformValues[key]
        if (typeof resting === 'number') return resting
        return key.startsWith('scale') ? 1 : 0
    }

    // Resolve the numeric keyframe sequence for a composed channel. Array
    // targets play in full — upstream plays the authored keyframes as-is, so
    // element 0 is the explicit start and no visual seed is injected. Scalar
    // targets seed the start from the frozen visual value, then move to target.
    // Returns null when the target (or any array element) is non-numeric, so
    // the caller can fall back to unit-value handling.
    const resolveComposedKeyframes = (key: string, target: unknown): number[] | null => {
        if (Array.isArray(target) && target.length > 1) {
            const numbers = target.map((entry) =>
                typeof entry === 'number' ? entry : Number.parseFloat(String(entry))
            )
            return numbers.every((entry) => Number.isFinite(entry)) ? numbers : null
        }
        const targetNumber = getFinalNumber(target)
        return targetNumber == null ? null : [readChannelStart(key), targetNumber]
    }

    // Resolve the ms-API transition for a composed channel. An explicit
    // component/inline transition wins; `{}` (the merged default when neither
    // the `transition` prop nor <MotionConfig> supplied one) counts as "no
    // explicit transition" and yields upstream's per-value defaults so a
    // default-transition hover matches framer-motion. A user-supplied
    // `{ duration: 0.6 }` is non-empty and is honored verbatim (no spring).
    // Upstream defaults: motion-dom/src/animation/utils/default-transitions.ts
    //   scale/scaleX/scaleY -> spring { stiffness: 550, damping: 30, restSpeed: 10 }
    //   x/y/rotate/translate -> spring { stiffness: 500, damping: 25, restSpeed: 10 }
    //   keyframes.length > 2  -> { type: 'keyframes', duration: 0.8 }
    // Springs are duration-free, so the seconds->ms conversion is a no-op for
    // them; the keyframes default's 0.8s becomes 800ms.
    const resolveComposedTransition = (
        explicit: AnimationOptions | undefined,
        key: string,
        keyframes: number[]
    ): Record<string, unknown> => {
        const chosen = explicit ?? mergedTransition
        if (chosen && Object.keys(chosen).length > 0) {
            return toMillisecondsTransition(chosen)
        }
        const defaults = getDefaultTransition(key, { keyframes })
        return toMillisecondsTransition(defaults)
    }

    // Start a composed-channel animation and wire it into the coordinator so the
    // tap system (and cleanup) can stop it. `mapSample` converts each raw
    // animateValue sample into the value written to the transform channel.
    const runChannelAnimation = (
        key: string,
        valueTransition: Record<string, unknown>,
        keyframes: number[],
        mapSample: (sample: number) => number | string,
        finalValue: number | string
    ) => {
        const registration: { unregister?: () => void } = {}
        const animation = animateValue({
            ...valueTransition,
            keyframes,
            onUpdate: (sample: number) => {
                liveChannelValues[key] = mapSample(sample)
                writeComposedChannels()
            },
            onComplete: () => {
                liveChannelValues[key] = finalValue
                writeComposedChannels()
                channelAnimations.delete(key)
                registration.unregister?.()
            }
        })
        channelAnimations.set(key, animation)
        registration.unregister = coordinator?.register(() => {
            animation.stop?.()
            if (channelAnimations.get(key) === animation) channelAnimations.delete(key)
        })
    }

    // Animate a unit-suffixed target ('-50%', '2rem') by mixing a 0->1 progress
    // between the start and target magnitudes, re-appending the shared unit each
    // frame. Only runs when the start value parses to the SAME unit; a bare
    // number (or px) start can't safely mix into a percentage target because
    // px<->% needs layout context this writer doesn't resolve, so those snap.
    const animateUnitChannel = (
        key: string,
        target: string,
        parsedTarget: { value: number; unit: string },
        transition: AnimationOptions | undefined
    ) => {
        const start = parseUnitValue(liveChannelValues[key] ?? restingTransformValues[key])
        if (!start || start.unit !== parsedTarget.unit) {
            liveChannelValues[key] = target
            writeComposedChannels()
            return
        }
        const from = start.value
        const to = parsedTarget.value
        runChannelAnimation(
            key,
            resolveComposedTransition(transition, key, [from, to]),
            [0, 1],
            (progress) => `${mixNumber(from, to, progress)}${parsedTarget.unit}`,
            target
        )
    }

    const animateComposedChannel = (
        key: string,
        target: unknown,
        transition: AnimationOptions | undefined
    ) => {
        // Caller has already stopped competing writers (see the branch-level
        // stopAll), so the start keyframe samples exactly where the element
        // visually froze.
        channelAnimations.get(key)?.stop?.()
        channelAnimations.delete(key)

        // Unit-suffixed string targets must not flow through the numeric path:
        // Number.parseFloat would silently drop the unit and animate a bare
        // number (e.g. '-50%' -> -50). Route them to unit-aware interpolation.
        if (!Array.isArray(target) && typeof target === 'string') {
            const parsedTarget = parseUnitValue(target)
            if (parsedTarget && parsedTarget.unit !== '') {
                animateUnitChannel(key, target, parsedTarget, transition)
                return
            }
        }

        const keyframes = resolveComposedKeyframes(key, target)
        if (keyframes == null) {
            // Truly non-numeric channel value (e.g. 'red', 'var(--x)'): apply
            // without tweening rather than dropping it — interpolation from an
            // unknown start type isn't safe.
            if (typeof target === 'string') {
                liveChannelValues[key] = target
                writeComposedChannels()
            }
            return
        }

        runChannelAnimation(
            key,
            resolveComposedTransition(transition, key, keyframes),
            keyframes,
            (value) => value,
            keyframes[keyframes.length - 1]
        )
    }

    // Route a gesture target to its writers. The composed writer engages when
    // `scale` participates (it must stack on authored base transforms); it then
    // owns every transform channel in the target so the native writer never
    // touches `el.style.transform`. Without scale, the native path is the
    // single transform writer, as before.
    const animateGestureTarget = (
        target: Record<string, unknown>,
        transition: AnimationOptions | undefined
    ) => {
        const { transform: transformKeys, native } = splitGestureTransformValues(target)
        if (transformKeys.scale == null) {
            if (Object.keys(target).length > 0) {
                animateNative(target, transition ?? mergedTransition)
            }
            return
        }
        for (const [key, value] of Object.entries(transformKeys)) {
            animateComposedChannel(key, value, transition)
        }
        if (Object.keys(native).length > 0) {
            animateNative(native, transition ?? mergedTransition)
        }
    }

    const handleDragStart = () => stopChannelAnimations()
    el.addEventListener('svelte-motion:drag-start', handleDragStart)

    // Run a native (non-composed) gesture animation, registering it so the
    // tap system can stop it in turn. Caller stops competing writers first.
    const animateNative = (keyframes: Record<string, unknown>, transition: AnimationOptions) => {
        const ctl = animate(el, keyframes as unknown as DOMKeyframesDefinition, transition)
        const unregister = coordinator?.register(() => {
            try {
                ctl.stop()
            } catch {
                // Finished animations may throw on stop; nothing keeps writing.
            }
        })
        void ctl.finished?.finally(() => unregister?.()).catch(() => undefined)
    }

    const cleanupHover = hover(el, () => {
        if (el.dataset.svelteMotionDragActive === 'true') return () => {}

        coordinator?.setActive('hover', true)
        // Hover start: compute baseline and animate to whileHover values
        hoverBaseline = computeHoverBaseline(el, {
            initial: baselineSources?.initial,
            animate: baselineSources?.animate,
            whileHover,
            baseValues: transformComposer?.getBaseTransformValues?.()
        })
        if (!transformComposer) fallbackBaseTransform = el.style.transform
        callbacks?.onStart?.()
        // Upstream protected keys: while a higher-priority tap is active, hover
        // only records its state — the tap release re-applies hover from the
        // coordinator flag (variant-props.ts priority order).
        if (!coordinator?.isActive('tap')) {
            // Single-writer: stop every in-flight gesture animation (ours and
            // the tap system's) before this transition's writers start.
            coordinator?.stopAll()
            const { keyframes, transition } = splitHoverDefinition(whileHover)
            animateGestureTarget(keyframes, transition)
        }

        // Return cleanup function for hover end
        return () => {
            coordinator?.setActive('hover', false)
            // While pressed, the tap state owns these keys — its release path
            // restores the correct target (base, now that hover is inactive).
            if (coordinator?.isActive('tap')) {
                callbacks?.onEnd?.()
                return
            }
            // Hover end: restore baseline values. Stop competing writers
            // first — e.g. a tap-release spring reapplying hover — so the
            // unwind is the single writer and starts from the frozen visual
            // state instead of snapping when the race resolves.
            if (hoverBaseline && Object.keys(hoverBaseline).length > 0) {
                coordinator?.stopAll()
                animateGestureTarget(hoverBaseline, undefined)
            }
            callbacks?.onEnd?.()
        }
    })

    return () => {
        stopChannelAnimations()
        el.removeEventListener('svelte-motion:drag-start', handleDragStart)
        cleanupHover()
    }
}
