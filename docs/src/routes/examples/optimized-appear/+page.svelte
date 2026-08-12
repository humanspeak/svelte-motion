<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Focus, Gauge, Sparkles, Timer } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import OptimizedAppearBlurFade from '$lib/examples/optimized-appear/demos/BlurFade.svelte'
    import OptimizedAppearDefault from '$lib/examples/optimized-appear/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Optimized appear' }
        ]
    }
    if (seo) {
        seo.title = 'Optimized appear | Svelte Motion'
        seo.description =
            'Use optimized appear animations to start SSR entrance motion before hydration.'
        seo.ogTitle = 'Optimized appear'
        seo.h1 = { title: 'Optimized appear', mode: 'sr-only' }
        seo.ogTagline = 'SSR entrance animations without the flash'
        seo.ogFeatures = ['SSR', 'Hydration', 'WAAPI', 'Blur fade']
        seo.ogSlug = 'examples-optimized-appear'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

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
        },
        {
            figId: 'FIG-002',
            tag: 'FILTER',
            title: { prefix: 'blur fade ', accent: 'beyond transforms', end: '.' },
            description:
                'Any animatable CSS property declared in initial/animate — filter, clip-path, color — now rides the same SSR appear path, so blur-fade entrances start before hydration.',
            snippet: blurFadeSection,
            codeSnippet: blurFadeCode,
            notes: blurFadeNotes,
            barCells: [{ k: 'filter', v: 'blur(8px) → blur(0px)' }],
            sourceUrl: `${SOURCE_URL}optimized-appear/demos/BlurFade.svelte`
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
            demoCodeSample(
                'optimized-appear/demos/Default.svelte',
                'optimized-appear-default',
                'Default.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}
{#snippet blurFadeSection()}
    <OptimizedAppearBlurFade />
{/snippet}
{#snippet blurFadeNotes()}
    <ul>
        <li>
            <Focus />
            <span>
                The SSR bootstrap emits a WAAPI entry for <code>filter</code> alongside opacity and transform,
                so the first frame is already mid blur-fade.
            </span>
        </li>
        <li>
            <Timer />
            <span>
                Staggered <code>delay</code> values ride along too — each line holds its blurred
                initial state with <code>fill: both</code> until its turn.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet blurFadeCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'optimized-appear/demos/BlurFade.svelte',
                'optimized-appear-blur-fade',
                'BlurFade.svelte'
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
