<script lang="ts">
    import {
        CodeReferenceV2,
        type DemoManifestEntry,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Hand, Layers, ListOrdered } from '@lucide/svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import ReorderDefault from '$lib/examples/reorder/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'Reorder' }]
    }
    if (seo) {
        seo.title = 'Reorder | Examples | Svelte Motion'
        seo.description =
            'Drag-to-reorder a task list. Items physically spring into their new positions, with a depth shadow on the dragged row and a checkbox-completion flow that bubbles done items to the bottom.'
        seo.ogTitle = 'Reorder'
        seo.ogTagline = 'Drag to reorder, watch it spring'
        seo.ogFeatures = ['Drag', 'Layout springs', 'Auto-scroll', 'Reorder.Group']
        seo.ogSlug = 'examples-reorder'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const manifest = demoManifest as Record<string, DemoManifestEntry>

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'COMPONENT',
            title: { prefix: 'drag to ', accent: 'reorder', end: '.' },
            description:
                "A `Reorder.Group` of `Reorder.Item`s. Grab any row and the others physically spring out of the way as your drag offset crosses each neighbour's centre — same primitive the framer-motion 2 launch demo used.",
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'drag-to-reorder list' }],
            sourceUrl: `${SOURCE_URL}reorder/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <ReorderDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Hand />
            <span>
                Each row is a <code>Reorder.Item</code> with
                <code>drag=&#123;axis&#125;</code> and <code>dragSnapToOrigin</code> wired
                automatically. The group's <code>onReorder</code> fires the moment your drag offset crosses
                a neighbour's centre — you swap as you drag, not on release.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                <code>layout=&#123;true&#125;</code> on each item turns the swap into a physical
                spring. Combined with a per-row <code>useMotionValue</code> box-shadow animated on
                <code>onDragStart</code> / <code>onDragEnd</code>, the dragged row visually lifts
                off the stack.
            </span>
        </li>
        <li>
            <ListOrdered />
            <span>
                The completion flow shows off mixing motion primitives: a <code>motion.span</code>
                fades the text to 45% opacity while another scales a coloured bar across via
                <code>scaleX</code>, then the parent shuffles completed rows to the bottom after a
                600ms delay so the strikethrough actually plays.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'reorder-default',
                label: 'Default.svelte',
                ...manifest['reorder/demos/Default.svelte']
            },
            {
                id: 'reorder-item',
                label: 'Item.svelte',
                ...manifest['reorder/demos/Item.svelte']
            }
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
