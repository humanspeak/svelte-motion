<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { BoxSelect, MousePointer2, ScanSearch } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import TransformPagePointDefault from '$lib/examples/transform-page-point/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Scaled Drag Board' }
        ]
    }
    if (seo) {
        seo.title = 'Scaled Drag Board | Svelte Motion'
        seo.description =
            'A zoomable constrained board whose draggable tile stays under the pointer with transformPagePoint.'
        seo.ogTitle = 'Scaled Drag Board'
        seo.h1 = { title: 'Scaled Drag Board', mode: 'sr-only' }
        seo.ogTagline = 'Pointer-accurate drag at every zoom level'
        seo.ogFeatures = ['MotionConfig', 'Scaled Drag', 'Ref Constraints', 'Zoom Presets']
        seo.ogSlug = 'examples-transform-page-point'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'GESTURE',
            title: { prefix: 'zoomed ', accent: 'drag board', end: '.' },
            description:
                'Switch zoom levels, then drag the tile. Coordinate correction keeps its visible center under the pointer and its edges inside the measured board.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'scaled constrained drag' }],
            sourceUrl: `${SOURCE_URL}transform-page-point/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}<TransformPagePointDefault />{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <ScanSearch /><span>Choose 50%, 100%, 150%, or nonuniform zoom before dragging.</span>
        </li>
        <li>
            <MousePointer2 /><span
                >The tile follows the pointer in screen space while callbacks remain in local board
                units.</span
            >
        </li>
        <li>
            <BoxSelect /><span
                >The measured ref keeps every resting edge inside the visible board.</span
            >
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'transform-page-point/demos/Default.svelte',
                'transform-page-point-default',
                'Default.svelte'
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
