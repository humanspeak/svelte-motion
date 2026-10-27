<script lang="ts">
    /**
     * Keyboard-reordering fixture, a port of the `List` in upstream Motion
     * 14.6.0 `Reorder/__tests__/keyboard.test.tsx`.
     *
     * `apply` picks how `onReorder` writes back: `'replace'` assigns the new
     * array, `'splice'` mutates the `$state` array in place, `'none'` leaves
     * the order to the test (rerender with new `values`). `rendered`, when
     * set, renders only those values (unrendered values stay in `values`).
     */
    import { Reorder } from '$lib/reorder'
    import type { ReorderAxis } from '../types'

    let {
        values = ['a', 'b', 'c'],
        axis = 'y',
        dir,
        apply = 'replace',
        rendered,
        onReorder,
        itemProps = {}
    }: {
        values?: string[]
        axis?: ReorderAxis
        dir?: 'rtl'
        apply?: 'replace' | 'splice' | 'none'
        rendered?: string[]
        onReorder?: (next: string[], moved: string) => void
        itemProps?: Record<string, unknown>
    } = $props()

    // svelte-ignore state_referenced_locally
    let local = $state([...values])
    // `none` is controlled: the test rerenders with new `values`.
    const items = $derived(apply === 'none' ? values : local)

    const handleReorder = (next: string[], moved: string) => {
        onReorder?.(next, moved)
        if (apply === 'replace') local = next
        else if (apply === 'splice') local.splice(0, local.length, ...next)
    }
</script>

<Reorder.Group
    {axis}
    values={items}
    onReorder={handleReorder}
    style={dir ? `direction: ${dir}` : undefined}
    data-testid="group"
>
    {#each rendered ?? items as item (item)}
        <Reorder.Item value={item} data-testid={item} whileDrag={{ opacity: 0.5 }} {...itemProps}>
            {item}
            <input data-testid="{item}-input" />
        </Reorder.Item>
    {/each}
</Reorder.Group>
