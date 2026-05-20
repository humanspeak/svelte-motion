<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { LayoutGrid, Repeat, Zap } from '@lucide/svelte'
    import type { Snippet } from 'svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import ReorderingDefault from '$lib/examples/reordering/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Reordering' }
        ]
    }
    if (seo) {
        seo.title = 'Reordering | Examples | Svelte Motion'
        seo.description =
            'Drag-to-reorder list items with smooth layout animations using Svelte Motion. Demonstrates drag gestures and automatic layout transitions.'
        seo.ogTitle = 'Reordering'
        seo.ogTagline =
            'Drag-to-reorder list items with smooth layout animations using Svelte Motion'
        seo.ogFeatures = ['Drag Gestures', 'Layout Animation', 'List Reorder', 'Smooth FLIP']
        seo.ogSlug = 'examples-reordering'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    type Section = {
        figId: string
        tag: string
        title: { prefix?: string; accent: string; end?: string }
        description: string
        snippet: Snippet
        codeSnippet?: Snippet
        notes?: Snippet
        mode?: 'live' | 'static'
        barCells?: { k: string; v: string }[]
        sourceUrl?: string
    }

    type ManifestEntry = {
        code: string
        lang: string
        html?: { light: string; dark: string }
    }
    const manifest = demoManifest as Record<string, ManifestEntry>

    const sections: Section[] = [
        {
            figId: 'FIG-001',
            tag: 'LAYOUT',
            title: { prefix: 'shuffling ', accent: 'list items', end: '.' },
            description:
                'Four coloured tiles shuffle their order every second. Each tile carries `layout` — motion measures the rect before + after the array mutation, then springs each tile between positions.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'flip-reorder' }],
            sourceUrl: `${SOURCE_URL}reordering/demos/Default.svelte`
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

{#snippet defaultSection()}
    <ReorderingDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <LayoutGrid />
            <span>
                The list keys on <code>backgroundColor</code> — Svelte tracks the same item across re-renders
                even when its index changes, so motion sees a position change instead of an unmount +
                remount and can FLIP it.
            </span>
        </li>
        <li>
            <Zap />
            <span>
                Each <code>motion.li</code> has <code>layout</code> on it. Motion samples each item's
                rect before and after the array mutation; the difference becomes the FLIP delta, and the
                configured spring carries the tile to its new spot.
            </span>
        </li>
        <li>
            <Repeat />
            <span>
                Shuffle fires from a <code>setTimeout</code> in <code>onMount</code>, recursing via
                <code>scheduleNextShuffle()</code>
                so a single source schedules every cycle. <code>onMount</code>'s cleanup clears the
                pending timeout — important when the component unmounts mid-flight.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'reordering-default',
                label: 'Default.svelte',
                ...manifest['reordering/demos/Default.svelte']
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
        sheetLabel="SHEET {pad2(i + 1)} / {pad2(sections.length)}"
        barCells={section.barCells}
        sourceUrl={section.sourceUrl}
        codeSnippet={section.codeSnippet}
        codeLabel="show code"
        notes={section.notes}
    >
        {@render section.snippet()}
    </ExampleV2>
{/each}
