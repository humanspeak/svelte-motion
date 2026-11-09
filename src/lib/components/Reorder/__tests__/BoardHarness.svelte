<script lang="ts">
    /**
     * Fixtures for `board.component.spec.ts`, ports of the components in
     * Motion 14.10.1 `Reorder/__tests__/board.test.tsx`: `Board` (the
     * default `variant`), `ScrollingBoard`, `Virtualized`, `Columns`, the
     * "without a Board" `Groups` and the unmounted-items `List`. `capture`
     * is that test's `Capture`, rendered inside a group to read its context.
     */
    import { domMax, LazyMotion } from '$lib'
    import { Reorder as MReorder } from '$lib/m'
    import { Reorder as MainReorder } from '$lib/reorder'
    import { getReorderContext, type ReorderContextProps } from '../context'
    import type { ReorderAxis } from '../types'
    import Self from './BoardHarness.svelte'

    type Lists = Record<string, string[]>

    let {
        variant = 'board',
        initial = { A: ['a', 'b'], B: ['c', 'd'] },
        axis = 'y',
        onReorder,
        reject,
        canMove,
        hidden,
        stacked = false,
        lazy = false,
        shown = 3,
        from = 0,
        inBoard = false,
        bindRef = false,
        onLists,
        onCapture,
        ...itemProps
    }: {
        variant?:
            'board' | 'scrolling' | 'virtualized' | 'columns' | 'noBoard' | 'unmounted' | 'capture'
        initial?: Lists
        axis?: ReorderAxis
        onReorder?: (id: string, order: string[], moved: string) => void
        reject?: (id: string) => boolean
        canMove?: (value: string, from: string[], to: string[]) => boolean
        /** A group to hide, like display: none. */
        hidden?: string
        /** Stack the groups down the page, rather than side by side. */
        stacked?: boolean
        /** Render `Reorder` from the `m` entry inside `LazyMotion`. */
        lazy?: boolean
        /** `virtualized`: how many of B's items are rendered. */
        shown?: number
        /** `unmounted`: the first of the three rendered values. */
        from?: number
        /** `unmounted`: inside a `Reorder.Board`. */
        inBoard?: boolean
        /** `unmounted`: bind each item's `ref`. */
        bindRef?: boolean
        /** Called with the lists whenever they change. */
        onLists?: (lists: Lists) => void
        /** `capture`: called with the enclosing group's context. */
        onCapture?: (context: ReorderContextProps<unknown> | undefined) => void
        [key: string]: unknown
    } = $props()

    if (variant === 'capture') onCapture?.(getReorderContext())

    // svelte-ignore state_referenced_locally
    let lists = $state<Lists>(
        variant === 'columns' ? { x: ['a'], y: ['b'] } : structuredClone(initial)
    )
    let columns = $state(['x', 'y'])

    $effect(() => onLists?.($state.snapshot(lists)))

    /**
     * Sets the lists, as the app would (upstream `setBoardLists`).
     *
     * @param update - Returns the new lists from the latest ones.
     */
    export const setLists = (update: (latest: Lists) => Lists): void => {
        lists = update($state.snapshot(lists))
    }

    const R = $derived(lazy ? MReorder : MainReorder)

    const update = (id: string) => (order: string[], moved: string) => {
        onReorder?.(id, order, moved)
        if (reject?.(id)) return
        lists = { ...lists, [id]: order }
    }

    const numbers = [0, 1, 2, 3, 4, 5]
    const refs: Record<number, HTMLElement | undefined> = $state({})
</script>

{#snippet board()}
    <R.Board {canMove}>
        {#each Object.keys(lists) as id (id)}
            <R.Group
                {axis}
                hidden={id === hidden}
                data-stacked={stacked || undefined}
                data-testid={id}
                values={lists[id]}
                onReorder={update(id)}
            >
                {#each lists[id] as value (value)}
                    <R.Item {value} data-testid={value} {...itemProps}>{value}</R.Item>
                {/each}
            </R.Group>
        {/each}
    </R.Board>
{/snippet}

{#snippet numberGroup()}
    <MainReorder.Group axis="y" values={numbers} onReorder={() => {}}>
        <Self variant="capture" {onCapture} />
        {#each numbers.slice(from, from + 3) as value (value)}
            {#if bindRef}
                <MainReorder.Item {value} bind:ref={refs[value]} />
            {:else}
                <MainReorder.Item {value} />
            {/if}
        {/each}
    </MainReorder.Group>
{/snippet}

{#if variant === 'capture'}
    <!-- Renders nothing: it only reads the group's context. -->
{:else if variant === 'board'}
    {#if lazy}
        <LazyMotion features={domMax}>{@render board()}</LazyMotion>
    {:else}
        {@render board()}
    {/if}
{:else if variant === 'scrolling'}
    <MainReorder.Board>
        <div data-testid="board">
            {#each Object.keys(lists) as id (id)}
                <div data-testid={`${id}-column`}>
                    <MainReorder.Group
                        axis="y"
                        data-testid={id}
                        values={lists[id]}
                        onReorder={update(id)}
                    >
                        {#each lists[id] as value (value)}
                            <MainReorder.Item {value} data-testid={value}>{value}</MainReorder.Item>
                        {/each}
                    </MainReorder.Group>
                </div>
            {/each}
        </div>
    </MainReorder.Board>
{:else if variant === 'virtualized'}
    <MainReorder.Board>
        {#each Object.keys(lists) as id (id)}
            <MainReorder.Group axis="y" data-testid={id} values={lists[id]} onReorder={update(id)}>
                {#each lists[id].slice(0, id === 'B' ? shown : undefined) as value (value)}
                    <MainReorder.Item {value} data-testid={value} />
                {/each}
            </MainReorder.Group>
        {/each}
    </MainReorder.Board>
{:else if variant === 'columns'}
    <!-- A list of columns, each holding a list of cards -->
    <MainReorder.Board>
        <MainReorder.Group
            axis="y"
            data-testid="columns"
            values={columns}
            onReorder={(order: string[]) => (columns = order)}
        >
            {#each columns as id (id)}
                <MainReorder.Item value={id} data-testid={id}>
                    <MainReorder.Group
                        axis="y"
                        data-testid={`${id}-cards`}
                        values={lists[id]}
                        onReorder={update(id)}
                    >
                        {#each lists[id] as card (card)}
                            <MainReorder.Item value={card} data-testid={card} />
                        {/each}
                    </MainReorder.Group>
                </MainReorder.Item>
            {/each}
        </MainReorder.Group>
    </MainReorder.Board>
{:else if variant === 'noBoard'}
    {#each Object.keys(lists) as id (id)}
        <MainReorder.Group axis="y" values={lists[id]} onReorder={update(id)}>
            {#each lists[id] as value (value)}
                <MainReorder.Item {value} data-testid={value} />
            {/each}
        </MainReorder.Group>
    {/each}
{:else if variant === 'unmounted'}
    {#if inBoard}
        <MainReorder.Board>{@render numberGroup()}</MainReorder.Board>
    {:else}
        {@render numberGroup()}
    {/if}
{/if}
