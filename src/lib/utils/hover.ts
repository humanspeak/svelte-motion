import { type AnimationOptions } from 'motion'

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

// `attachWhileHover` lived here (~460 lines: per-channel MotionValues, a
// composed transform writer, coordinator setActive/protected-key emulation).
// Deleted by plan 003 — hover is `attachHoverGesture` in gestures.ts now, which
// only flips `setActive('whileHover', …)`.
//
// The helpers ABOVE stay: `computeHoverBaseline` and `splitHoverDefinition` are
// imported by `drag.ts` (whileDrag) and by the container's whilePan path, and
// `readTransformChannels` backs the container's relative-keyframe live reader.
// All three are plan 005's to retire.
