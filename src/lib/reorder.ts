import Board from '$lib/components/Reorder/Board.svelte'
import Group from '$lib/components/Reorder/Group.svelte'
import Item from '$lib/components/Reorder/Item.svelte'

/**
 * Drag-to-reorder components, mirroring framer-motion's `Reorder`
 * namespace (`Reorder/namespace.ts`).
 *
 * @example
 * ```svelte
 * <script>
 *     import { Reorder } from '@humanspeak/svelte-motion'
 *     let items = $state([0, 1, 2, 3])
 * </script>
 *
 * <Reorder.Group axis="y" values={items} onReorder={(next) => (items = next)}>
 *     {#each items as item (item)}
 *         <Reorder.Item value={item}>{item}</Reorder.Item>
 *     {/each}
 * </Reorder.Group>
 * ```
 *
 * Wrap groups in `Reorder.Board` to drag items between them (Motion 14.10):
 *
 * ```svelte
 * <Reorder.Board>
 *     <Reorder.Group values={todo} onReorder={(next) => (todo = next)}>
 *         {#each todo as item (item)}
 *             <Reorder.Item value={item}>{item}</Reorder.Item>
 *         {/each}
 *     </Reorder.Group>
 *     <Reorder.Group values={done} onReorder={(next) => (done = next)}>
 *         {#each done as item (item)}
 *             <Reorder.Item value={item}>{item}</Reorder.Item>
 *         {/each}
 *     </Reorder.Group>
 * </Reorder.Board>
 * ```
 */
export const Reorder: {
    readonly Board: typeof Board
    readonly Group: typeof Group
    readonly Item: typeof Item
} = {
    Board,
    Group,
    Item
} as const
