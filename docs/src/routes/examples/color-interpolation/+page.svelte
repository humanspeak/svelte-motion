<script lang="ts">
    import {
        CodeReferenceV2,
        type DemoManifestEntry,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Palette, Route, Sparkles } from '@lucide/svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import ColorInterpolationDefault from '$lib/examples/color-interpolation/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Color Interpolation' }
        ]
    }
    if (seo) {
        seo.title = 'Color Interpolation | Examples | Svelte Motion'
        seo.description =
            'Smooth color transitions between multiple color values using Svelte Motion. Demonstrates interpolation across the full color spectrum.'
        seo.ogTitle = 'Color Interpolation'
        seo.ogTagline = 'Smooth color transitions between multiple color values using Svelte Motion'
        seo.ogFeatures = [
            'Color Transitions',
            'Spectrum Animation',
            'Smooth Interpolation',
            'Multi-Color'
        ]
        seo.ogSlug = 'examples-color-interpolation'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const manifest = demoManifest as Record<string, DemoManifestEntry>

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'COLOR',
            title: { prefix: 'rgb vs ', accent: 'hsl', end: '.' },
            description:
                'The browser`s Web Animations API and motion`s `animate()` interpolate colours differently. Watch them side by side: the left swatch sweeps through hue (HSL), the right takes a straight line in RGB space.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'interpolation comparison' }],
            sourceUrl: `${SOURCE_URL}color-interpolation/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <ColorInterpolationDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Route />
            <span>
                Same start (<code>#ff0088</code>) and end (<code>#0d63f8</code>) colour for both
                swatches — only the interpolation path differs.
            </span>
        </li>
        <li>
            <Palette />
            <span>
                The left swatch (WAAPI) sweeps through HSL space, so the midpoint takes a detour
                through orange / green / cyan before reaching blue. The right swatch (motion) walks
                straight through RGB space — magenta dims, blue brightens, no hue detour.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                Pure motion call: <code>animate(element, &#123;backgroundColor: […]&#125;, …)</code>
                binds an imperative animation lifecycle to the element. The returned controls let you
                <code>cancel()</code> on cleanup so the animation doesn't outlive the component.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'color-interpolation-default',
                label: 'Default.svelte',
                ...manifest['color-interpolation/demos/Default.svelte']
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
