import { svelteMotionDragElements } from '$lib/utils/drag'
import { DEV } from 'esm-env'
import { drag as motionDrag } from 'motion'
import { resolveElements, type DragOptions, type ElementOrSelector } from 'motion-dom'

export type { DragOptions } from 'motion-dom'

/**
 * Elements that already produced the "already has a motion.* drag gesture"
 * warning, so each element warns at most once.
 */
const warnedElements = new WeakSet<Element>()

const noop = () => {}

/**
 * Make plain elements draggable without a `motion.*` component (Motion 14.4's
 * vanilla `drag()`).
 *
 * The dragged element's `x` and `y` are motion values shared with `animate()`
 * and `animateLayout()`, so an element moved by `animate()` keeps its offset
 * when a drag starts, and can be animated again after a drag. Called inside a
 * `scopeMotion` / `useScopeMotion` setup, a selector resolves within the
 * scope's root and the gesture is removed when the scope stops.
 *
 * Elements that already drag through a svelte-motion `motion.*` component
 * (`drag` prop) are skipped, because two drag controllers on one element would
 * both write `x`/`y`. In development a warning is logged once per skipped
 * element. Detection relies on the component's drag gesture being attached,
 * which happens once the element reports `data-is-loaded="ready"`: calling
 * `drag()` on a `motion.*` drag element before it is ready is not detected.
 *
 * Upstream implementation: motion-dom `src/gestures/drag/index.ts`.
 *
 * @see https://motion.dev/docs/drag
 *
 * @param elementOrSelector - An element, a list of elements, or a CSS selector.
 * @param options - Drag options: `axis`, `constraints` (a box or an element),
 *   `elastic`, `momentum`, `transition`, `snapToOrigin`, `directionLock`,
 *   `propagation`, and the `onStart`/`onMove`/`onEnd`/`onDirectionLock`/
 *   `onTransitionEnd`/`onMeasureConstraints` callbacks.
 * @returns A function that removes the gesture and restores the element's
 *   inline drag styles and `draggable` attribute.
 *
 * @example
 * ```ts
 * import { drag } from '@humanspeak/svelte-motion'
 *
 * const stop = drag(knob, { axis: 'x', constraints: track })
 * // later
 * stop()
 * ```
 */
export function drag(
    elementOrSelector: ElementOrSelector,
    options: DragOptions = {}
): VoidFunction {
    const elements = resolveElements(elementOrSelector).filter((element) => {
        if (!svelteMotionDragElements.has(element)) return true
        if (DEV && !warnedElements.has(element)) {
            warnedElements.add(element)
            console.warn(
                '[svelte-motion] drag(): element already has a motion.* drag gesture; use its drag props instead.'
            )
        }
        return false
    })

    if (elements.length === 0) return noop

    return motionDrag(elements, options)
}
