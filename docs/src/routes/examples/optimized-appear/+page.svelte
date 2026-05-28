<script lang="ts">
    import {
        CodeReferenceV2,
        type DemoManifestEntry,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Gauge, Sparkles } from '@lucide/svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import OptimizedAppearDefault from '$lib/examples/optimized-appear/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Optimized appear' }
        ]
    }
    if (seo) {
        seo.title = 'Optimized appear | Examples | Svelte Motion'
        seo.description =
            'Use optimized appear animations to start SSR entrance motion before hydration.'
        seo.ogTitle = 'Optimized appear'
        seo.ogTagline = 'SSR entrance animations without the flash'
        seo.ogFeatures = ['SSR', 'Hydration', 'WAAPI', 'Appear handoff']
        seo.ogSlug = 'examples-optimized-appear'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const manifest = demoManifest as Record<string, DemoManifestEntry>

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'SSR',
            title: { prefix: 'start ', accent: 'before hydration', end: '.' },
            description:
                'The server renders the initial opacity/transform and an inline handoff script starts the same transition before Svelte Motion mounts.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'handoff', v: 'data-framer-appear-id' }],
            sourceUrl: `${SOURCE_URL}optimized-appear/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <OptimizedAppearDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Gauge />
            <span>
                The optimized appear bootstrap uses WAAPI for opacity and transform so the first
                visible frame already belongs to the entrance animation.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                Hydration hands the animation back to the normal motion runtime using the upstream
                <code>data-framer-appear-id</code> contract.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'optimized-appear-default',
                label: 'Default.svelte',
                ...manifest['optimized-appear/demos/Default.svelte']
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
