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
 */
export const Reorder = {
    Group,
    Item
} as const
