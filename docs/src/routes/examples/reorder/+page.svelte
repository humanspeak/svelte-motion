<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { GripVertical, Hand, Layers, MoveVertical, ScrollText, Zap } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import ReorderDefault from '$lib/examples/reorder/demos/Default.svelte'
    import ReorderScrollable from '$lib/examples/reorder/demos/Scrollable.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'Reorder' }]
    }
    if (seo) {
        seo.title = 'Reorder | Svelte Motion'
        seo.description =
            'Drag-to-reorder lists with Reorder.Group and Reorder.Item — axis-locked dragging, FLIP siblings, and edge auto-scroll in scrollable containers.'
        seo.ogTitle = 'Reorder'
        seo.h1 = { title: 'Reorder', mode: 'sr-only' }
        seo.ogTagline = 'Drag-to-reorder lists with automatic layout animations'
        seo.ogFeatures = ['Drag To Reorder', 'FLIP Siblings', 'Axis Locking', 'Edge Auto-Scroll']
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
