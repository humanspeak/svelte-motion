<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Box, Gauge, Layers } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import SvgCssVariables from '$lib/examples/svg-css-variables/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'SVG CSS Variables' }
        ]
    }
    if (seo) {
        seo.title = 'SVG CSS Variables | Svelte Motion'
        seo.description = 'Draw, trim, and erase a glowing SVG path by animating CSS variables.'
        seo.ogTitle = 'SVG CSS Variables'
        seo.h1 = { title: 'SVG CSS Variables', mode: 'sr-only' }
        seo.ogTagline = 'Drawn in light'
        seo.ogFeatures = ['animate', 'CSS variables', 'Replay', 'Reset']
        seo.ogSlug = 'examples-svg-css-variables'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/svg-css-variables/demos/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'SVG',
            title: { prefix: 'a winding path, ', accent: 'drawn in light', end: '.' },
            description:
                'Animate CSS variables directly on SVG paths. Scrub the visible segment or replay a draw-and-erase sequence.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'animate' },
                { k: 'input', v: 'CSS variables' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <SvgCssVariables />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Box /><span
                ><code>animate()</code> writes custom properties directly onto the SVG paths.</span
            >
        </li>
        <li>
            <Gauge /><span
                ><code>pathLength="1"</code> normalizes the stroke so trim values run from zero to one.</span
            >
        </li>
        <li>
            <Layers /><span
                ><code>animate(sequence)</code> draws, erases, and restores the path with upstream sequencing.</span
            >
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'svg-css-variables/demos/Default.svelte',
                'svg-css-variables-default',
                'Default.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#each sections as section, index (section.figId)}
    <ExampleV2
        figId={section.figId}
        tag={section.tag}
        title={section.title}
        description={section.description}
        mode={section.mode ?? 'live'}
        sheetLabel={formatSheetLabel(index, sections.length)}
        barCells={section.barCells}
        sourceUrl={section.sourceUrl}
        codeSnippet={section.codeSnippet}
        codeLabel="show code"
        notes={section.notes}
    >
        {@render section.snippet()}
    </ExampleV2>
{/each}
