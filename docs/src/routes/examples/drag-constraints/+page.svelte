<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { BoxSelect, Hand, MousePointer2 } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import DragConstraintsDefault from '$lib/examples/drag-constraints/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Drag Constraints' }
        ]
    }
    if (seo) {
        seo.title = 'Drag Constraints | Examples | Svelte Motion'
        seo.description =
            'A polished constrained-drag stage showing elastic overdrag, ref bounds, and spring settling with Svelte Motion.'
        seo.ogTitle = 'Drag Constraints'
        seo.h1 = { title: 'Drag Constraints', mode: 'sr-only' }
        seo.ogTagline = 'Elastic drag constrained to a measured ref'
        seo.ogFeatures = ['Drag', 'Constraints', 'Elasticity', 'Spring Settling']
        seo.ogSlug = 'examples-drag-constraints'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'DRAG',
            title: { prefix: 'elastic ', accent: 'constraint stage', end: '.' },
            description:
                'A constrained drag pattern for product UIs: the tile can be pulled against the bounds with a little elastic give, then springs back inside the measured ref on release.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'ref-constrained drag' }],
            sourceUrl: `${SOURCE_URL}drag-constraints/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <DragConstraintsDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Hand />
            <span>
                Drag the tile past any edge. The <code>dragElastic</code> value allows a small overpull
                while the pointer is down, so the bounds feel physical instead of mechanically clipped.
            </span>
        </li>
        <li>
            <BoxSelect />
            <span>
                The stage element is passed directly into <code>dragConstraints</code>. Svelte
                Motion measures that ref and keeps the final resting position inside it.
            </span>
        </li>
        <li>
            <MousePointer2 />
            <span>
                Release outside the stage or re-grab during the spring-back. The card should settle
                smoothly without jumping or fighting the pointer.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'drag-constraints/demos/Default.svelte',
                'drag-constraints-default',
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
