<script lang="ts" generics="V">
    /**
     * Lets items be dragged between the `Reorder.Group`s inside it. Port of
     * Motion 14.10.1 `Reorder/Board.tsx` `ReorderBoard`, pointer path.
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
     *
     * When an item's centre is dragged over another group, it moves there:
     * the group it left calls `onReorder` without it, and the group it joined
     * calls `onReorder` with it, both passing it as the moved value. Their
     * other items animate to make room, and the drag carries on in the new
     * group.
     *
     * `canMove` can refuse a move before either group updates.
     *
     * Values must be unique across the groups. If the app keeps the groups'
     * values in one state, update it from the latest state, as both groups
     * update it in turn.
     *
     * Renders no element of its own.
     *
     * @prop canMove - Whether `value` can move from the group whose values are `from` to the group whose values are `to`.
     */
    import { createBoard, setReorderBoardContext } from './board'
    import type { ReorderBoardProps } from './types'

    let { canMove, children }: ReorderBoardProps<V> = $props()

    // Svelte: a getter replaces upstream's latest-props ref.
    setReorderBoardContext(createBoard(() => ({ canMove: canMove as never })))
</script>

{@render children?.()}
