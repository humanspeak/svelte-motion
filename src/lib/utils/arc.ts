/**
 * `arc()` — curved motion paths for `transition.path`.
 *
 * Thin wrapper over upstream motion-dom's `arc()` (Motion 13). The curve
 * geometry, `pathRotation` channel, and layout projection hook are upstream's,
 * untouched; this module only adds an endpoint guard upstream lacks.
 *
 * Upstream `arc.animateVisualElement` reads the current and target `x`/`y`
 * and does bezier arithmetic on them as raw numbers. A unit-bearing value —
 * `'100px'`, `'50%'`, `'var(--x)'` — is legal for `x`/`y` everywhere else in
 * the API but turns that arithmetic into `NaN`, so the element renders an
 * invalid transform mid-flight and snaps to the target on completion. Rather
 * than fork the math to parse units (and diverge from upstream), the wrapper
 * detects non-numeric endpoints, warns once in dev, and leaves `x`/`y` to the
 * normal straight-line keyframe loop — the element still arrives, just not on
 * a curve.
 *
 * Release note (post-1.x follow-up): revisit the numerics here once upstream
 * decides how `arc()` should treat unit-bearing endpoints — either adopt their
 * resolution or drop this guard when motion-dom ships its own. Tracked in the
 * `arc()` docs page under "Numeric x/y only".
 */

import { DEV } from 'esm-env'
import { arc as upstreamArc, type ArcOptions, type MotionPath } from 'motion-dom'

/** Keyframe shapes upstream `arc()` can interpolate without producing `NaN`. */
const isNumericKeyframe = (value: unknown): boolean => {
    if (value === undefined) return true
    if (typeof value === 'number') return Number.isFinite(value)
    if (Array.isArray(value)) {
        // Upstream reads `[0]` (wildcard `null` falls back to the current
        // value) and the last entry; anything else must be a finite number.
        return value.every(
            (entry, index) =>
                (index === 0 && entry === null) ||
                (typeof entry === 'number' && Number.isFinite(entry))
        )
    }
    return false
}

/** Whether a MotionValue's current reading is safe to feed the bezier. */
const isNumericCurrent = (value: unknown): boolean =>
    value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value))

/**
 * Create a curved path for `transition.path`.
 *
 * Identical to upstream Motion's `arc()` — same options, same geometry, same
 * `layout`/`layoutId` projection behaviour — with one addition: when the
 * animation's `x`/`y` endpoints are not plain numbers (e.g. `'100px'`,
 * `'50%'`), the path steps aside and the values animate along the default
 * straight line instead of rendering `NaN` transforms. A one-time
 * `console.warn` explains the fallback in development builds.
 *
 * Reuse the returned path (create it in `<script>`, not inline in the
 * template) so its auto-direction continuity state survives re-renders.
 *
 * @param options Arc shape — `strength`, `peak`, `direction`, `rotate`.
 * @returns A `MotionPath` to assign to `transition.path` or
 *   `transition.layout.path`.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { arc, motion } from '@humanspeak/svelte-motion'
 *   const path = arc({ strength: 1, rotate: true })
 * </script>
 *
 * <motion.div animate={{ x: 200, y: 0 }} transition={{ duration: 1, path }} />
 * ```
 */
export const arc = (options: ArcOptions = {}): MotionPath => {
    const path = upstreamArc(options)
    let warned = false

    return {
        interpolateProjection: (delta) => path.interpolateProjection(delta),
        animateVisualElement(visualElement, target, transition, delay, animations) {
            if (!('x' in target || 'y' in target)) return

            const endpointsNumeric = (['x', 'y'] as const).every((key) => {
                const raw = (target as Record<string, unknown>)[key]
                // No default: `getValue(key, default)` would create the value.
                // Mirror upstream's read order (MotionValue, then latestValues).
                const current: unknown =
                    visualElement.getValue(key)?.get() ?? visualElement.latestValues[key]
                return isNumericKeyframe(raw) && isNumericCurrent(current)
            })

            if (!endpointsNumeric) {
                if (DEV && !warned) {
                    warned = true
                    console.warn(
                        '[svelte-motion] arc() requires numeric x/y endpoints; ' +
                            'a unit-bearing value (e.g. "100px", "50%") was found, so x/y ' +
                            'will animate along a straight line instead of the arc.'
                    )
                }
                // Leave `x`/`y` on `target` so animateTarget's keyframe loop
                // animates them normally.
                return
            }

            path.animateVisualElement(visualElement, target, transition, delay, animations)
        }
    }
}

export type { ArcOptions } from 'motion-dom'
