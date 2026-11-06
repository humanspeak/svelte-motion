<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Ban, Columns3, Hand, Keyboard, Layers, ScrollText } from '@lucide/svelte'
    import { demoCodeSample } from '#lib/demo-loaders.js'
    import { getBreadcrumbContext } from '#lib/components/contexts/Breadcrumb/Breadcrumb.context.js'
    import { getSeoContext } from '#lib/components/contexts/Seo/Seo.context.js'
    import ReorderBoardKanban from '#lib/examples/reorder-board/demos/Kanban.svelte'
    import ReorderBoardLimitedColumn from '#lib/examples/reorder-board/demos/LimitedColumn.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Reorder.Board' }
        ]
    }
    if (seo) {
        seo.title = 'Reorder.Board | Svelte Motion'
        seo.description =
            'Drag cards between kanban columns with Reorder.Board: both columns update in one gesture, canMove enforces a WIP limit, and columns auto-scroll.'
        seo.ogTitle = 'Reorder.Board'
        seo.h1 = { title: 'Reorder.Board', mode: 'sr-only' }
        seo.ogTagline = 'Drag items between reorderable lists'
        seo.ogFeatures = ['Kanban Columns', 'canMove', 'Keyboard', 'Two-Axis Scroll']
        seo.ogSlug = 'examples-reorder-board'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'BOARD',
            title: { prefix: 'drag between ', accent: 'columns', end: '.' },
            description:
                'A three-column kanban board. Drag a card sideways into another column and it joins that column mid-gesture: the cards there spring apart to make room, and the drag carries on so you can still pick its slot.',
            snippet: kanbanSection,
            codeSnippet: kanbanCode,
            notes: kanbanNotes,
            barCells: [{ k: 'pattern', v: 'reorder-board' }],
            sourceUrl: `${SOURCE_URL}reorder-board/demos/Kanban.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'LIMIT',
            title: { prefix: 'refuse a move with ', accent: 'canMove', end: '.' },
            description:
                'The Doing column holds at most three cards. Once it is full, a card dragged over it stays in its own column — canMove refuses the move before either column changes.',
            snippet: limitedColumnSection,
            codeSnippet: limitedColumnCode,
            notes: limitedColumnNotes,
            barCells: [{ k: 'canMove', v: 'wip ≤ 3' }],
            sourceUrl: `${SOURCE_URL}reorder-board/demos/LimitedColumn.svelte`
        }
    ]
</script>

{#snippet kanbanSection()}
    <ReorderBoardKanban />
{/snippet}
{#snippet kanbanNotes()}
    <ul>
        <li>
            <Columns3 />
            <span>
                <code>Reorder.Board</code> wraps ordinary <code>Reorder.Group</code>s and renders no
                element. When a card's centre crosses into another column, the column it left calls
                <code>onReorder</code> without it and the column it joins calls
                <code>onReorder</code> with it.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                All three columns live in one <code>$state</code> record, and each column writes
                only its own key, so the two <code>onReorder</code> calls never overwrite each other.
                Card titles are unique across the board.
            </span>
        </li>
        <li>
            <ScrollText />
            <span>
                Each column scrolls when its cards outgrow it. Hold a dragged card near a column's
                top or bottom edge and that column auto-scrolls beneath it.
            </span>
        </li>
        <li>
            <Keyboard />
            <span>
                Tab to a card and press Space to grab it. Up and Down move it within its column,
                Left and Right carry it to the next column, and Escape puts it back where it was
                grabbed.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet kanbanCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'reorder-board/demos/Kanban.svelte',
                'reorder-board-kanban',
                'Kanban.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet limitedColumnSection()}
    <ReorderBoardLimitedColumn />
{/snippet}
{#snippet limitedColumnNotes()}
    <ul>
        <li>
            <Ban />
            <span>
                <code>canMove(card, from, to)</code> runs before either column's
                <code>onReorder</code>. Here it compares <code>to</code> with the Doing column's array
                and refuses once that column holds three cards.
            </span>
        </li>
        <li>
            <Hand />
            <span>
                A refused card simply stays in its column until it's dragged over one that accepts
                it. Reordering inside the full column still works.
            </span>
        </li>
        <li>
            <Keyboard />
            <span>
                <code>canMove</code> runs every frame while a card hovers a full column, so keep it a
                cheap check with no side effects. Escape ignores it and always restores the grab.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet limitedColumnCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'reorder-board/demos/LimitedColumn.svelte',
                'reorder-board-limited-column',
                'LimitedColumn.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#each sections as section, i (section.figId)}
    <ExampleV2
        figId={section.figId}
        tag={section.tag}
        title={section.title}
        description={section.description}
        mode={section.mode ?? 'live'}
        sheetLabel={formatSheetLabel(i, sections.length)}
        barCells={section.barCells}
        sourceUrl={section.sourceUrl}
        codeSnippet={section.codeSnippet}
        codeLabel="show code"
        notes={section.notes}
    >
        {@render section.snippet()}
    </ExampleV2>
{/each}
