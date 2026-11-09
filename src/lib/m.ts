import Board from '$lib/components/Reorder/Board.svelte'
import Group from '$lib/components/Reorder/Group.svelte'
import Item from '$lib/components/Reorder/Item.svelte'
import type { MotionComponents } from '$lib/html/index'
import * as html from '$lib/html/index'
import { MOTION_KIND_PROP, withMotionKind } from '$lib/utils/motionKind'

/**
 * Lazy motion component namespace used with `<LazyMotion>`.
 *
 * The namespace mirrors the `motion` object API (`m.div`, `m.button`,
 * `m.svg`, etc.), but its components get their features only from the
 * nearest `<LazyMotion>` (upstream `render/components/m/create.ts`), while
 * `motion` components always have every feature and ignore it.
 *
 * Outside any `<LazyMotion>`, or while an async `features` bundle is still
 * loading (or after it failed), an `m` component has no features, as in
 * Motion: it renders its `style`, `initial`, `tabindex` and the drag styles,
 * and runs no animation, gesture, drag, layout or exit. Once a bundle loads it
 * animates in from `initial`.
 *
 * @example
 * ```svelte
 * <LazyMotion features={domAnimation}>
 *     <m.div whileHover={{ scale: 1.1 }} />
 * </LazyMotion>
 * ```
 */
export const m: MotionComponents = Object.fromEntries(
    Object.entries(html).map(([key, component]) => [
        key.toLowerCase(),
        /* @__PURE__ */ withMotionKind(component, { [MOTION_KIND_PROP]: 'm' })
    ])
) as MotionComponents

/**
 * Drag-to-reorder components that render `m` components, so they get their
 * features from the nearest `<LazyMotion>` (Motion 14.7.0
 * `Reorder/m-namespace.ts`, #2232). Reordering needs `domMax`. The main
 * `Reorder` from `@humanspeak/svelte-motion` renders `motion` components,
 * which always have every feature.
 *
 * @example
 * ```svelte
 * <script>
 *     import { LazyMotion, domMax } from '@humanspeak/svelte-motion'
 *     import { Reorder } from '@humanspeak/svelte-motion/m'
 *     let items = $state([0, 1, 2])
 * </script>
 *
 * <LazyMotion features={domMax} strict>
 *     <Reorder.Group axis="y" values={items} onReorder={(next) => (items = next)}>
 *         {#each items as item (item)}
 *             <Reorder.Item value={item}>{item}</Reorder.Item>
 *         {/each}
 *     </Reorder.Group>
 * </LazyMotion>
 * ```
 *
 * `Reorder.Board` lets items be dragged between the groups inside it
 * (Motion 14.10). It renders no element, so it's the same component here.
 */
export const Reorder: {
    readonly Board: typeof Board
    readonly Group: typeof Group
    readonly Item: typeof Item
} = {
    Board,
    Group: /* @__PURE__ */ withMotionKind(Group, { [MOTION_KIND_PROP]: 'm' }),
    Item
} as const
