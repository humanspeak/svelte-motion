import { drag as dragCore } from 'motion'
import type { DragOptions } from 'motion-dom'
import type { AnyMotionValue } from './transform.svelte.js'

/**
 * Options for {@link drag}: motion-dom's `DragOptions`, with the Motion 14.10
 * `x` / `y` options widened to accept this library's motion values (from
 * `motionValue()` / `useMotionValue()`) as well as raw motion-dom ones.
 */
export type SvelteDragOptions = Omit<DragOptions, 'x' | 'y'> & {
    /**
     * Motion value to write the horizontal drag to, instead of the element's
     * own `x`. When `x` or `y` is set, the element itself doesn't move.
     */
    x?: AnyMotionValue<number>
    /**
     * Motion value to write the vertical drag to, instead of the element's
     * own `y`. When `x` or `y` is set, the element itself doesn't move.
     */
    y?: AnyMotionValue<number>
}

/**
 * Make an element draggable without a motion component (Motion 14.4).
 * Identical to motion's `drag` at runtime — this is a type-level cast, not a
 * wrapper, so `drag === motion's drag`.
 *
 * The re-type widens the Motion 14.10 `x` / `y` options to accept this
 * library's augmented motion values. When either is set, drag writes to
 * those values instead of moving the element, so it can drive something
 * else — a dial's rotation, a scrubber, a headless slider.
 *
 * @param elementOrSelector The element(s), or a CSS selector, to make draggable.
 * @param options Axis, constraints, elastic, momentum, handlers and the
 * headless `x` / `y` motion values.
 * @returns A function that stops dragging and cleans up.
 * @example
 * ```ts
 * import { drag, motionValue } from '@humanspeak/svelte-motion'
 *
 * const x = motionValue(0)
 * x.on('change', (v) => (dial.style.rotate = `${v}deg`))
 *
 * // The dial stays put; horizontal drag turns it.
 * const stop = drag(dial, { axis: 'x', x })
 * ```
 */
export const drag = dragCore as (
    elementOrSelector: Parameters<typeof dragCore>[0],
    options?: SvelteDragOptions
) => ReturnType<typeof dragCore>
