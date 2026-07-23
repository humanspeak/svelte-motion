import type { GestureCoordinator } from '$lib/utils/gestureCoordinator'
import {
    buildGestureTransform,
    collectGestureTransformValues,
    splitGestureTransformValues,
    type GestureTransformValues
} from '$lib/utils/transformComposer'
import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'
import {
    animateMotionValue,
    getDefaultTransition,
    hover,
    mixNumber,
    motionValue,
    type MotionValue,
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

/**
 * Read the element's current 2D transform channels from its computed matrix —
 * the VISUAL values, regardless of which system last wrote them.
 *
 * Decomposes `matrix(a, b, c, d, e, f)`: translation is `(e, f)`, uniform scale
 * is `hypot(a, b)`, and rotation is `atan2(b, a)` in degrees (the same sign
 * convention the browser reports and that motion writes). Returns identity
 * values for `none`/unparseable input, and `null` for a `matrix3d(...)`
 * transform — 3D decomposition is out of scope (see plan 002), so callers seed
 * only the channels this 2D reader can trust and leave 3D channels alone.
 *
 * @param el Target element.
 * @returns `{ scale, x, y, rotate }` visual channel values (identity when
 *   untransformed), or `null` when the transform is a 3D matrix.
 * @example
 * ```ts
 * const visual = readTransformChannels(el) // seed each channel continuously
 * ```
 */
export const readTransformChannels = (
    el: HTMLElement
): { scale: number; x: number; y: number; rotate: number } | null => {
    const identity = { scale: 1, x: 0, y: 0, rotate: 0 }
    const transform = getComputedStyle(el).transform
    if (!transform || transform === 'none') return identity
    // A 3D transform serializes to matrix3d(...); this 2D reader cannot safely
    // decompose it, so signal null and let the caller skip those channels.
    if (transform.includes('matrix3d')) return null
    const matrix = transform.match(/matrix\(([^)]+)\)/)
    if (!matrix) return identity

    const [a, b, , , e, f] = matrix[1].split(',').map((part) => Number.parseFloat(part.trim()))
    if (!Number.isFinite(a) || !Number.isFinite(b)) return identity
    return {
        scale: Math.hypot(a, b),
        x: Number.isFinite(e) ? e : 0,
        y: Number.isFinite(f) ? f : 0,
        rotate: (Math.atan2(b, a) * 180) / Math.PI
    }
}

/**
 * Return a shallow copy of `record` keeping only keys the predicate accepts.
 *
 * @param record Source key/value record.
 * @param keep Predicate deciding whether each key survives.
 * @return A new record with only the kept keys.
 */
const filterRecord = (
    record: Record<string, unknown>,
    keep: (key: string) => boolean
): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(record)) {
        if (keep(key)) out[key] = record[key]
    }
    return out
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

/**
 * Compute the baseline values to restore to on hover end.
 *
 * Preference order per key (mirrors upstream `VisualElement.getBaseTarget`,
 * which has no neutral-default step — an authored value always wins):
 * `animate` → `initial` → style-authored base transform values → inline
 * CSS-function value → for NON-transform keys, the authored base style value
 * (the caller's creation-time record captured at rest, else a live
 * computed-style read as an at-rest fallback) → neutral transform defaults →
 * computed-style index fallback.
 *
 * Transform channels intentionally skip the authored-style step: a computed
 * `transform` is a matrix string, not a per-channel value, so restoring
 * `scale`/`rotate` to it is meaningless — those keys land on their neutral
 * default when nothing is authored via `animate`/`initial`/`baseValues`.
 *
 * Non-transform authored values (e.g. `opacity`) come from `baseStyleValues` —
 * a record the caller captures ONCE at element creation while at rest. Reading
 * live `getComputedStyle` at hover START would capture a transient
 * mid-animation value on rapid hover/unhover cycles (the value would settle
 * partway instead of on the authored rest value); the creation-time record is
 * stable regardless of when hover fires. The live-cs fallback here only fires
 * when the caller supplied no record for the key — an at-rest / standalone path
 * where live computed style is safe.
 *
 * @param el Target element.
 * @param opts Source records for baseline computation. `baseValues` carries
 * style-authored transform channels, which this function cannot read from the
 * element itself; without them a style-authored channel (e.g. rotate) would
 * neutral-default and the gesture would settle to neutral, then snap once the
 * authored style repaints. `baseStyleValues` carries non-transform authored
 * values (e.g. `opacity`) captured at creation-time so hover-end restores the
 * true rest value rather than a mid-animation transient.
 * @return Minimal baseline record to restore on hover end.
 */
export const computeHoverBaseline = (
    el: HTMLElement,
    opts: {
        initial?: Record<string, unknown>
        animate?: Record<string, unknown>
        whileHover?: Record<string, unknown>
        baseValues?: Record<string, unknown>
        baseStyleValues?: Record<string, unknown>
    }
): Record<string, unknown> => {
    const baseline: Record<string, unknown> = {}
    const initialRecord = opts.initial ?? {}
    const animateRecord = opts.animate ?? {}
    const baseValuesRecord = opts.baseValues ?? {}
    const baseStyleValuesRecord = opts.baseStyleValues ?? {}
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

    // Transform channels are every neutral default except opacity: their
    // computed value only exists as a matrix string, so they must not consult
    // authored computed style and instead fall through to the neutral default.
    const transformChannelKeys = new Set(
        Object.keys(neutralTransformDefaults).filter((k) => k !== 'opacity')
    )

    // Coerce a fully-numeric string (e.g. '1', '0.8') to a number; leave every
    // other string as-is. motion's animate mishandles a numeric-STRING endpoint
    // (a timing artifact — the value snaps rather than interpolating), and the
    // semantic value here is numeric. The plan's unit assertions were written
    // format-agnostic (Number(baseline.x)) for exactly this reason.
    const coerceNumericString = (value: string): string | number => {
        const asNumber = Number(value)
        return Number.isFinite(asNumber) && String(asNumber) === value.trim() ? asNumber : value
    }

    // Resolve the authored value for a NON-transform key. Prefers the caller's
    // creation-time base-style record (captured at rest — never a hover-start
    // transient); only when the caller supplied no entry for this key does it
    // fall back to a live computed-style read (at-rest/standalone path where
    // live cs is safe). Prefers getPropertyValue(kebab) over the camelCase
    // index access and guards test doubles whose computed style lacks
    // getPropertyValue. Returns undefined when nothing meaningful is present so
    // the caller can continue down the preference chain to the neutral default.
    const readAuthoredValue = (key: string): unknown => {
        if (baseStyleValuesRecord[key] !== undefined) {
            const authored = baseStyleValuesRecord[key]
            return typeof authored === 'string' ? coerceNumericString(authored) : authored
        }
        if (typeof cs.getPropertyValue === 'function') {
            const kebabCase = key.replace(/([A-Z])/g, '-$1').toLowerCase()
            const viaProperty = cs.getPropertyValue(kebabCase)
            if (viaProperty) return coerceNumericString(viaProperty)
        }
        const viaIndex = (cs as unknown as Record<string, unknown>)[key]
        if (typeof viaIndex === 'string' && viaIndex !== '') return coerceNumericString(viaIndex)
        return undefined
    }

    for (const key of Object.keys(whileHoverRecord)) {
        if (Object.prototype.hasOwnProperty.call(animateRecord, key)) {
            baseline[key] = animateRecord[key]
            continue
        }
        if (Object.prototype.hasOwnProperty.call(initialRecord, key)) {
            baseline[key] = initialRecord[key]
            continue
        }
        if (baseValuesRecord[key] !== undefined) {
            baseline[key] = baseValuesRecord[key]
            continue
        }
        // Inline style CSS function (var/calc/…) for this property, if present.
        const inlineValue = getInlineStyleValue(key)
        if (inlineValue) {
            baseline[key] = inlineValue
            continue
        }
        // Non-transform keys prefer the authored value (creation-time record,
        // else at-rest computed style) over the neutral default — upstream
        // getBaseTarget reads the DOM with no neutral step. Transform channels
        // skip this — see transformChannelKeys.
        if (!transformChannelKeys.has(key)) {
            const authored = readAuthoredValue(key)
            if (authored !== undefined) {
                baseline[key] = authored
                continue
            }
        }
        if (key in neutralTransformDefaults) {
            baseline[key] = neutralTransformDefaults[key]
            continue
        }
        // Final fallback: computed-style index access for anything else.
        if (key in (cs as unknown as Record<string, unknown>)) {
            baseline[key] = (cs as unknown as Record<string, unknown>)[key]
        }
    }
    return baseline
}

type HoverTransformComposerOptions = {
    getBaseTransformValues?: () => GestureTransformValues
    getLiveTransformValues?: () => GestureTransformValues | null
    getBaseTransform?: () => string
    transformTemplate?: TransformTemplate
    /**
     * Non-transform authored base values (e.g. `opacity`) the caller captured
     * ONCE at element creation while at rest. Threaded into
     * `computeHoverBaseline` so hover-end restores the true rest value rather
     * than a mid-animation transient read via live `getComputedStyle`.
     */
    getBaseStyleValues?: () => Record<string, unknown>
    /**
     * Per-element registry of persistent per-channel `MotionValue`s the composed
     * writer drives (upstream backs every animated channel with a `MotionValue`,
     * so interrupting a spring re-targets the SAME value and position AND
     * velocity carry into the next animation). When the caller shares one map
     * across the hover and tap systems, the tap handoff can read each channel's
     * live velocity (`interaction.ts` `seedStaleChannels`) instead of discarding
     * it. Omitted (standalone/tests) → the hover attachment owns a private map.
     */
    channelValues?: Map<string, MotionValue<number>>
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
    //
    // Numeric channels ride a PERSISTENT per-channel `MotionValue` (upstream
    // backs every animated value with one). Interrupting a spring starts a new
    // `animateMotionValue` on the SAME value, which seeds the generator with the
    // value's live position AND velocity — so a mid-flight hover↔tap handoff or
    // rapid re-hover carries momentum instead of re-seeding from zero. The map
    // is shared with the tap system (via composer options) so its handoff can
    // read each channel's velocity; when unshared the attachment owns a private
    // map. `channelSubscriptions` holds each value's one change→write
    // subscription so teardown removes it (no leak).
    const channelValues = transformComposer?.channelValues ?? new Map<string, MotionValue<number>>()
    const channelSubscriptions = new Map<string, () => void>()
    // Unit-suffixed / non-numeric channels (e.g. '-50%', 'red') can't ride a
    // numeric MotionValue; their latest composed string lives here and is driven
    // by a throwaway progress MotionValue (see animateUnitChannel).
    const liveStringChannels: Record<string, string> = {}
    // Each entry pairs the channel animation's stopper with its coordinator
    // unregister, so teardown drains BOTH — stopping the animation and removing
    // the stopper closure from the coordinator's Set. Tracking only the stopper
    // (and unregistering solely from onComplete) leaks the closure whenever an
    // animation is stopped before it completes.
    const channelAnimations = new Map<string, { stop?: () => void; unregister?: () => void }>()

    // Merge every owned channel's current value into one record: numeric
    // channels read their MotionValue's live `.get()`, string/unit channels
    // read their last composed string.
    const collectLiveChannelValues = (): GestureTransformValues => {
        const out: GestureTransformValues = {}
        for (const [key, value] of channelValues) out[key] = value.get()
        for (const key of Object.keys(liveStringChannels)) out[key] = liveStringChannels[key]
        return out
    }

    const writeComposedChannels = () => {
        const liveChannelValues = collectLiveChannelValues()
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
        for (const entry of channelAnimations.values()) {
            entry.stop?.()
            // Idempotent with onComplete's unregister (coordinator.register
            // returns a Set-delete closure); drops the stopper the coordinator
            // would otherwise retain until this element is GC'd.
            entry.unregister?.()
        }
        channelAnimations.clear()
    }

    // Initial value for a channel's persistent MotionValue, read ONCE at
    // creation. Scale reads the element's VISUAL scale so a first hover seeds
    // continuously from whatever the element is rendering; every other channel
    // starts at its resting/base value. After creation the MotionValue itself is
    // the source of truth — subsequent interrupts seed from `.get()`/velocity, so
    // this never re-reads computed style on the animate path.
    const readChannelStart = (key: string): number => {
        if (key === 'scale') return readTransformScale(el)
        const resting = restingTransformValues[key]
        if (typeof resting === 'number') return resting
        return key.startsWith('scale') ? 1 : 0
    }

    // Lazily create (once) the persistent MotionValue backing a numeric channel,
    // wiring its single change→write subscription. Reused across every animation
    // on that channel so velocity is continuous.
    const getChannelValue = (key: string): MotionValue<number> => {
        let value = channelValues.get(key)
        if (!value) {
            value = motionValue(readChannelStart(key))
            channelValues.set(key, value)
            channelSubscriptions.set(
                key,
                value.on('change', () => writeComposedChannels())
            )
        }
        return value
    }

    // Classify a composed-channel target as a scalar number, an all-numeric
    // keyframe array (length > 1, played in full — upstream plays authored
    // arrays as-is), or non-numeric (null → the caller routes to unit/string
    // handling). Scalars carry no explicit start: `animateMotionValue` resolves
    // the `[null, target]` seed from the value's live position, so momentum is
    // preserved.
    const resolveNumericTarget = (
        target: unknown
    ): { scalar: number } | { array: number[] } | null => {
        if (Array.isArray(target) && target.length > 1) {
            const numbers = target.map((entry) =>
                typeof entry === 'number' ? entry : Number.parseFloat(String(entry))
            )
            return numbers.every((entry) => Number.isFinite(entry)) ? { array: numbers } : null
        }
        const targetNumber = getFinalNumber(target)
        return targetNumber == null ? null : { scalar: targetNumber }
    }

    // Resolve the seconds-API transition for a composed channel. An explicit
    // component/inline transition wins; `{}` (the merged default when neither
    // the `transition` prop nor <MotionConfig> supplied one) counts as "no
    // explicit transition" and yields upstream's per-value defaults so a
    // default-transition hover matches framer-motion. A user-supplied
    // `{ duration: 0.6 }` is non-empty and is honored verbatim (no spring).
    // Upstream defaults: motion-dom/src/animation/utils/default-transitions.ts
    //   scale/scaleX/scaleY -> spring { stiffness: 550, damping: 30, restSpeed: 10 }
    //   x/y/rotate/translate -> spring { stiffness: 500, damping: 25, restSpeed: 10 }
    //   keyframes.length > 2  -> { type: 'keyframes', duration: 0.8 }
    // Unlike the old `animateValue` path, `animateMotionValue` takes upstream's
    // seconds-based transitions and converts durations to ms itself, so there is
    // NO seconds->ms conversion here (springs are duration-free anyway).
    const resolveComposedTransitionSeconds = (
        explicit: AnimationOptions | undefined,
        key: string,
        keyframes: number[]
    ): Record<string, unknown> => {
        const chosen = explicit ?? mergedTransition
        if (chosen && Object.keys(chosen).length > 0) {
            return { ...(chosen as Record<string, unknown>) }
        }
        return getDefaultTransition(key, { keyframes })
    }

    // Retarget a numeric channel's persistent MotionValue. `animateMotionValue`
    // seeds the generator with `value.getVelocity()`, so starting a new one on
    // the same value carries velocity through the interrupt (upstream). The
    // previous animation on this value is stopped for coordinator bookkeeping,
    // which does NOT reset velocity (only `jump()` does). Registration is wired
    // AFTER the start so a synchronous test-double completion can't unregister a
    // stopper that isn't stored yet.
    const runChannelAnimation = (
        key: string,
        value: MotionValue<number>,
        target: number | number[],
        transitionSeconds: Record<string, unknown>,
        finalValue: number
    ) => {
        const registration: { unregister?: () => void } = {}
        const entry: { stop?: () => void; unregister?: () => void } = {}
        const controls = animateMotionValue(
            key,
            value,
            target as number,
            transitionSeconds as Parameters<typeof animateMotionValue>[3]
        )(() => {
            // Settle exactly on the final value (springs finish within restSpeed
            // of it); the change subscription writes the composed transform.
            value.set(finalValue)
            channelAnimations.delete(key)
            registration.unregister?.()
        })
        entry.stop = () => controls?.stop?.()
        channelAnimations.set(key, entry)
        registration.unregister = coordinator?.register(() => {
            controls?.stop?.()
            if (channelAnimations.get(key) === entry) channelAnimations.delete(key)
        })
        entry.unregister = registration.unregister
    }

    // Animate a unit-suffixed target ('-50%', '2rem') by mixing a 0->1 progress
    // between the start and target magnitudes, re-appending the shared unit each
    // frame. A throwaway progress MotionValue drives the tween (upstream backs
    // string interpolation with a progress value too). Only runs when the start
    // value parses to the SAME unit; a bare number (or px) start can't safely
    // mix into a percentage target because px<->% needs layout context this
    // writer doesn't resolve, so those snap.
    const animateUnitChannel = (
        key: string,
        target: string,
        parsedTarget: { value: number; unit: string },
        transition: AnimationOptions | undefined
    ) => {
        const currentString = liveStringChannels[key] ?? restingTransformValues[key]
        const start = parseUnitValue(currentString)
        if (!start || start.unit !== parsedTarget.unit) {
            liveStringChannels[key] = target
            writeComposedChannels()
            return
        }
        const from = start.value
        const to = parsedTarget.value
        const unit = parsedTarget.unit
        const transitionSeconds = resolveComposedTransitionSeconds(transition, key, [from, to])

        const progress = motionValue(0)
        const unsubscribe = progress.on('change', () => {
            liveStringChannels[key] = `${mixNumber(from, to, progress.get())}${unit}`
            writeComposedChannels()
        })
        const registration: { unregister?: () => void } = {}
        const entry: { stop?: () => void; unregister?: () => void } = {}
        const controls = animateMotionValue(
            key,
            progress,
            1,
            transitionSeconds as Parameters<typeof animateMotionValue>[3]
        )(() => {
            liveStringChannels[key] = target
            writeComposedChannels()
            unsubscribe()
            channelAnimations.delete(key)
            registration.unregister?.()
        })
        entry.stop = () => {
            controls?.stop?.()
            unsubscribe()
        }
        channelAnimations.set(key, entry)
        registration.unregister = coordinator?.register(() => {
            controls?.stop?.()
            unsubscribe()
            if (channelAnimations.get(key) === entry) channelAnimations.delete(key)
        })
        entry.unregister = registration.unregister
    }

    const animateComposedChannel = (
        key: string,
        target: unknown,
        transition: AnimationOptions | undefined
    ) => {
        // Drop the previous animation on this channel for coordinator
        // bookkeeping. The persistent MotionValue keeps its position AND
        // velocity, so the retarget below still carries momentum.
        const existing = channelAnimations.get(key)
        existing?.stop?.()
        existing?.unregister?.()
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

        const numeric = resolveNumericTarget(target)
        if (numeric == null) {
            // Truly non-numeric channel value (e.g. 'red', 'var(--x)'): apply
            // without tweening rather than dropping it — interpolation from an
            // unknown start type isn't safe.
            if (typeof target === 'string') {
                liveStringChannels[key] = target
                writeComposedChannels()
            }
            return
        }

        const value = getChannelValue(key)
        // Stale-value sync: a channel with NO live hover animation may have
        // frozen while another writer (the tap's element-level animation) owned
        // it — e.g. press interrupts hover at scale 1.49, tap animates the
        // ELEMENT to 0.9, and this value still holds 1.49. motion-dom defers
        // hover-end past an active press (pointer capture), so the deferred
        // restore fires at RELEASE and would launch from that fiction — a
        // one-frame snap to 1.49 before springing down. Re-sync the idle value
        // to the rendered visual first: `jump()` clears the (equally stale)
        // velocity and its change event rewrites the composed transform with
        // what is already rendered, so the sync itself is invisible. A LIVE
        // hover animation skips this — its value IS the truth, velocity intact.
        if (existing === undefined) {
            const visual = readTransformChannels(el)
            if (visual !== null) {
                const current = key.startsWith('scale')
                    ? visual.scale
                    : visual[key as 'x' | 'y' | 'rotate']
                if (Number.isFinite(current) && Math.abs(current - value.get()) > 0.001) {
                    value.jump(current)
                }
            }
        }
        if ('array' in numeric) {
            runChannelAnimation(
                key,
                value,
                numeric.array,
                resolveComposedTransitionSeconds(transition, key, numeric.array),
                numeric.array[numeric.array.length - 1]
            )
        } else {
            runChannelAnimation(
                key,
                value,
                numeric.scalar,
                resolveComposedTransitionSeconds(transition, key, [value.get(), numeric.scalar]),
                numeric.scalar
            )
        }
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

        const { keyframes, transition } = splitHoverDefinition(whileHover)
        // Upstream protectedKeys: hover records the keys it owns so a
        // higher-priority tap can protect its own keys from us and we protect
        // nothing tap already owns.
        coordinator?.setActive('hover', true, Object.keys(keyframes))
        // Hover start: compute baseline and animate to whileHover values
        hoverBaseline = computeHoverBaseline(el, {
            initial: baselineSources?.initial,
            animate: baselineSources?.animate,
            whileHover,
            baseValues: transformComposer?.getBaseTransformValues?.(),
            baseStyleValues: transformComposer?.getBaseStyleValues?.()
        })
        if (!transformComposer) fallbackBaseTransform = el.style.transform
        callbacks?.onStart?.()
        // Per-key ownership (upstream animation-state.ts protectedKeys): apply
        // only the keys no higher-priority (tap) gesture owns. tap-owned keys
        // (e.g. an overlapping `scale`) stay untouched and re-apply through the
        // tap release's reapplyHoverIfActive path — unchanged arbitration.
        const unprotected = filterRecord(keyframes, (k) => !coordinator?.isKeyProtected(k, 'hover'))
        if (Object.keys(unprotected).length > 0) {
            // Single-writer: when no tap is active this stops every in-flight
            // gesture animation before our writers start (unchanged behavior).
            // While a tap IS active we must NOT stopAll — that would kill the
            // tap's in-flight animation on ITS keys; the subset we apply is
            // disjoint from tap's keys by construction, so no writer fights.
            if (!coordinator?.isActive('tap')) coordinator?.stopAll()
            animateGestureTarget(unprotected, transition)
        }

        // Return cleanup function for hover end
        return () => {
            coordinator?.setActive('hover', false)
            // Per-key restore (upstream removed-key handling): restore only the
            // baseline keys NOT owned by a higher-priority (tap) gesture. Keys
            // tap owns (e.g. an overlapping `scale`) keep deferring to tap's
            // release — unchanged arbitration for overlapping keys. Disjoint
            // keys tap never touched (e.g. `opacity` while tap owns `scale`)
            // restore immediately here instead of staying stuck until release.
            if (hoverBaseline) {
                const tapActive = coordinator?.isActive('tap')
                const restorable = filterRecord(
                    hoverBaseline,
                    (k) => !coordinator?.isKeyProtected(k, 'hover')
                )
                if (Object.keys(restorable).length > 0) {
                    // Stop competing writers first — e.g. a tap-release spring
                    // reapplying hover — so the unwind is the single writer and
                    // starts from the frozen visual state instead of snapping
                    // when the race resolves. While a tap is active we must NOT
                    // stopAll (it would kill tap's animation on its own keys);
                    // the restored subset is disjoint from tap's keys.
                    if (!tapActive) coordinator?.stopAll()
                    animateGestureTarget(restorable, undefined)
                }
            }
            callbacks?.onEnd?.()
        }
    })

    // Drain every persistent channel MotionValue: remove its change→write
    // subscription and stop/destroy the value. Without this the subscription
    // (and the value's internal frame hooks) outlive the element. The map may be
    // shared with the tap system; clearing it is safe because only the hover
    // writer creates entries, and a re-attach recreates them lazily.
    const teardownChannelValues = () => {
        for (const unsubscribe of channelSubscriptions.values()) unsubscribe()
        channelSubscriptions.clear()
        for (const value of channelValues.values()) {
            value.stop()
            value.destroy()
        }
        channelValues.clear()
    }

    return () => {
        stopChannelAnimations()
        teardownChannelValues()
        el.removeEventListener('svelte-motion:drag-start', handleDragStart)
        cleanupHover()
    }
}
