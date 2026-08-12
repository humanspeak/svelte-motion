<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import {
        Grid3x3,
        GripVertical,
        Hand,
        Languages,
        Layers,
        MoveHorizontal,
        MoveVertical,
        ScanSearch,
        ScrollText,
        Zap
    } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import ReorderDefault from '$lib/examples/reorder/demos/Default.svelte'
    import ReorderAutoAxisRtl from '$lib/examples/reorder/demos/AutoAxisRtl.svelte'
    import ReorderGrid from '$lib/examples/reorder/demos/Grid.svelte'
    import ReorderScrollable from '$lib/examples/reorder/demos/Scrollable.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'Reorder' }]
    }
    if (seo) {
        seo.title = 'Reorder | Svelte Motion'
        seo.description =
            'Drag-to-reorder lists and wrapped grids with automatic axis detection, RTL-aware insertion, FLIP siblings, and edge auto-scroll.'
        seo.ogTitle = 'Reorder'
        seo.h1 = { title: 'Reorder', mode: 'sr-only' }
        seo.ogTagline = 'Drag-to-reorder lists with automatic layout animations'
        seo.ogFeatures = ['Wrapped Grids', 'Auto Axis', 'RTL', 'Edge Auto-Scroll']
        seo.ogSlug = 'examples-reorder'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'GESTURE',
            title: { prefix: 'drag to ', accent: 'reorder', end: '.' },
            description:
                'The motion.dev grocery list. Grab any item and drag it vertically — the dragged item pins under the cursor while its siblings spring out of the way, and releasing snaps it into its new slot.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'reorder-group' }],
            sourceUrl: `${SOURCE_URL}reorder/demos/Default.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'GRID',
            title: { prefix: 'reorder in ', accent: 'two dimensions', end: '.' },
            description:
                'Drag one tile horizontally and vertically across wrapped rows. Every displaced tile springs into its new slot during the same continuous gesture.',
            snippet: gridSection,
            codeSnippet: gridCode,
            notes: gridNotes,
            barCells: [{ k: 'axis', v: 'xy' }],
            sourceUrl: `${SOURCE_URL}reorder/demos/Grid.svelte`
        },
        {
            figId: 'FIG-003',
            tag: 'RTL',
            title: { prefix: 'detect direction, ', accent: 'respect intent', end: '.' },
            description:
                'This horizontal group omits axis and renders RTL. Geometry selects horizontal dragging automatically, and visual leftward movement advances the logical data order without reversing the array.',
            snippet: autoAxisRtlSection,
            codeSnippet: autoAxisRtlCode,
            notes: autoAxisRtlNotes,
            barCells: [{ k: 'axis', v: 'auto' }],
            sourceUrl: `${SOURCE_URL}reorder/demos/AutoAxisRtl.svelte`
        },
        {
            figId: 'FIG-004',
            tag: 'SCROLL',
            title: { prefix: 'reordering ', accent: 'long lists', end: '.' },
            description:
                'Ten items in a 280px scroll container. Drag an item toward the top or bottom edge and hold — the container auto-scrolls beneath the held item so a single gesture can carry it the length of the list.',
            snippet: scrollableSection,
            codeSnippet: scrollableCode,
            notes: scrollableNotes,
            barCells: [{ k: 'pattern', v: 'auto-scroll' }],
            sourceUrl: `${SOURCE_URL}reorder/demos/Scrollable.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <ReorderDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <GripVertical />
            <span>
                <code>Reorder.Group</code> owns the order: it watches each drag and, when an item's
                edge crosses the midpoint of a neighbor, calls <code>onReorder</code> with the
                swapped array. Assigning that back to <code>$state</code> is the whole wiring.
            </span>
        </li>
        <li>
            <MoveVertical />
            <span>
                <code>axis="y"</code> locks item drags vertically. Items key on their own value in
                the <code>{'{#each}'}</code> block — the same value passed to
                <code>Reorder.Item</code>'s <code>value</code> prop.
            </span>
        </li>
        <li>
            <Hand />
            <span>
                <code>whileDrag</code> passes straight through to the underlying motion component — the
                lifted item scales up and gains a shadow while the gesture is active.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample('reorder/demos/Default.svelte', 'reorder-default', 'Default.svelte')
        ]}
        columns={1}
    />
{/snippet}

{#snippet gridSection()}
    <ReorderGrid />
{/snippet}
{#snippet gridNotes()}
    <ul>
        <li>
            <Grid3x3 />
            <span>
                <code>axis="xy"</code> clusters overlapping boxes into visual rows and chooses the nearest
                row and horizontal insertion slot as the tile moves.
            </span>
        </li>
        <li>
            <MoveHorizontal />
            <span>
                One uninterrupted gesture can cross both axes while keyed siblings FLIP into every
                newly vacated slot.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                The consumer still owns one flat <code>values</code> array; Reorder maps the visual wrapped
                layout back to that logical order.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet gridCode()}
    <CodeReferenceV2
        samples={[demoCodeSample('reorder/demos/Grid.svelte', 'reorder-grid', 'Grid.svelte')]}
        columns={1}
    />
{/snippet}

{#snippet autoAxisRtlSection()}
    <ReorderAutoAxisRtl />
{/snippet}
{#snippet autoAxisRtlNotes()}
    <ul>
        <li>
            <ScanSearch />
            <span>
                Omitting <code>axis</code> lets measured geometry select <code>x</code>,
                <code>y</code>, or <code>xy</code>; no orientation prop is needed for this row.
            </span>
        </li>
        <li>
            <Languages />
            <span>
                Direction comes from the group's computed style, so nested RTL regions behave
                correctly without changing document direction.
            </span>
        </li>
        <li>
            <MoveHorizontal />
            <span>
                Consumers keep values in logical order. Reorder interprets horizontal insertion in
                the visual direction instead of asking you to reverse the array.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet autoAxisRtlCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'reorder/demos/AutoAxisRtl.svelte',
                'reorder-auto-axis-rtl',
                'AutoAxisRtl.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet scrollableSection()}
    <ReorderScrollable />
{/snippet}
{#snippet scrollableNotes()}
    <ul>
        <li>
            <ScrollText />
            <span>
                The scroll container is a <code>motion.div</code> with <code>layoutScroll</code>, so
                layout measurements are taken in the container's coordinate space and stay correct
                at any scroll position.
            </span>
        </li>
        <li>
            <Zap />
            <span>
                Holding a dragged item within 50px of the container's edge auto-scrolls it — speed
                ramps up quadratically as the pointer nears the edge, and scrolling only starts when
                the gesture is moving toward that edge.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                Items keep reordering while the content scrolls beneath the held pointer, so one
                gesture can carry an item from the top of the list to the bottom.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet scrollableCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'reorder/demos/Scrollable.svelte',
                'reorder-scrollable',
                'Scrollable.svelte'
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
