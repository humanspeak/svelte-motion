<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Blend, Hash, Shapes } from '@lucide/svelte'
    import { demoCodeSample } from '#lib/demo-loaders.js'
    import { getBreadcrumbContext } from '#lib/components/contexts/Breadcrumb/Breadcrumb.context.js'
    import { getSeoContext } from '#lib/components/contexts/Seo/Seo.context.js'
    import TransitionMixerDefault from '#lib/examples/transition-mixer/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'transition.mixer' }
        ]
    }
    if (seo) {
        seo.title = 'transition.mixer | Svelte Motion'
        seo.description =
            'Morph SVG paths with different numbers of points by blending them with a custom transition.mixer.'
        seo.ogTitle = 'transition.mixer'
        seo.h1 = { title: 'transition.mixer', mode: 'sr-only' }
        seo.ogTagline = 'Blend anything'
        seo.ogFeatures = ['transition.mixer', 'SVG Path Morphing', 'flubber', 'Motion Parity']
        seo.ogSlug = 'examples-transition-mixer'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'TRANSITION',
            title: { prefix: 'morph paths with ', accent: 'different point counts', end: '.' },
            description:
                "A 10-point star morphs into a 4-point square. Motion can't blend their path data by default, so flubber's `interpolate` is the `transition.mixer`.",
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'transition.mixer' },
                { k: 'input', v: 'animate.d' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}transition-mixer/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <TransitionMixerDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Shapes />
            <span>
                The mixer gets the start and end path and returns a function from progress to a
                path.
            </span>
        </li>
        <li>
            <Blend />
            <span>
                flubber's <code>interpolate</code> setup only runs when that function is first called.
            </span>
        </li>
        <li>
            <Hash />
            <span>
                Numbers never call the mixer, and a mixer that returns <code>undefined</code> blends as
                usual.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'transition-mixer/demos/Default.svelte',
                'transition-mixer-default',
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
