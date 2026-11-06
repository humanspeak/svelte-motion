<script lang="ts">
    /**
     * Port of upstream `dev/react/src/tests/reorder-board.tsx` (Motion
     * 14.10.1): `Reorder.Board` lets items be dragged between its columns.
     *
     * - `?overflow`: the board is 300px wide and scrolls across, with the last
     *   column out of view, and each column scrolls down (upstream's
     *   `?overflow` mode of the same page).
     *
     * `state` shows each column's values; `drags` counts the items'
     * `onDragStart` and `onDragEnd` calls, which a drag carried across
     * columns makes once each.
     *
     * @component
     */
    import { page } from '$app/state'
    import { Reorder } from '$lib'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    const overflow = page.url.searchParams.has('overflow')

    const initial: Record<string, string[]> = {
        todo: ['a', 'b', 'c'],
        doing: ['d', 'e'],
        done: []
    }

    let columns = $state(structuredClone(initial))
    let drags = $state({ start: 0, end: 0 })

    const summary = $derived(
        Object.keys(columns)
            .map((id) => `${id}:${columns[id].join(',')}`)
            .join(' ')
    )

    const steps: TesterStep[] = [
        {
            text: 'Drag a card into the next column.',
            expected:
                'It moves there as soon as its centre is over the column, stays under your pointer at its whileDrag size, and settles into its slot on release. Drags reads 1,1 more.'
        },
        {
            text: 'Drag a card into the empty "done" column.',
            expected: 'It lands at the top of the column.'
        },
        {
            text: '(?overflow) Drag "a" to the right edge of the board and hold it there.',
            expected:
                'The board scrolls across to "done", not the column the card came from, and the card moves into "done" on the way.'
        }
    ]
</script>

<svelte:head>
    <title>Reorder · Board: drag between groups</title>
</svelte:head>

<div class="fixture">
    <div data-testid="state">{summary}</div>
    <div data-testid="drags">{`${drags.start},${drags.end}`}</div>
    <Reorder.Board>
        <div
            data-testid="board"
            style:display="flex"
            style:gap="50px"
            style:padding="50px"
            style:width={overflow ? '300px' : undefined}
            style:overflow-x={overflow ? 'auto' : undefined}
        >
            {#each Object.keys(columns) as id (id)}
                <div
                    style:flex-shrink="0"
                    style:height={overflow ? '320px' : undefined}
                    style:overflow-y={overflow ? 'auto' : undefined}
                >
                    <Reorder.Group
                        axis="y"
                        values={columns[id]}
                        onReorder={(order: string[]) => (columns = { ...columns, [id]: order })}
                        data-testid={id}
                        style="list-style: none; margin: 0; padding: 10px; width: 100px; height: 300px; background: #eee;"
                    >
                        {#each columns[id] as item (item)}
                            <Reorder.Item
                                value={item}
                                data-testid={item}
                                whileDrag={{ scale: 1.2, transition: { duration: 0.2 } }}
                                onDragStart={() => (drags = { ...drags, start: drags.start + 1 })}
                                onDragEnd={() => (drags = { ...drags, end: drags.end + 1 })}
                                style="position: relative; height: 50px; margin-bottom: 10px; background: #09f; color: white; user-select: none; -webkit-user-select: none;"
                            >
                                {item}
                            </Reorder.Item>
                        {/each}
                    </Reorder.Group>
                </div>
            {/each}
        </div>
    </Reorder.Board>
</div>

<TesterPanel
    eyebrow="Motion 14.10.1 · reorder-board.tsx"
    title="Reorder: Board"
    {steps}
    status="Covered by e2e/reorder/board.spec.ts."
>
    {#snippet checks()}
        <p>
            A <code>Reorder.Board</code> around several <code>Reorder.Group</code>s lets a dragged
            <code>Reorder.Item</code> move into the group its centre is over. The group it left
            calls
            <code>onReorder</code> without it, the group it joined with it, and the drag carries on
            in the new group without calling <code>onDragStart</code> again.
        </p>
        <p>
            Add <code>?overflow</code> for a board that scrolls across around columns that scroll down.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .fixture {
        padding: 16px;
    }
    /*
     * Upstream's page has no CSS reset, so its sizes are content-box: a
     * 300px wide board with 50px padding is 400px across, a 100px wide
     * group with 10px padding 120px. Undo Tailwind's border-box preflight
     * to keep that geometry, which the e2e spec's positions assume.
     */
    .fixture :global([data-testid='board']),
    .fixture :global([data-testid='board'] *) {
        box-sizing: content-box;
    }
    [data-testid='state'],
    [data-testid='drags'] {
        font-family: monospace;
    }
</style>
