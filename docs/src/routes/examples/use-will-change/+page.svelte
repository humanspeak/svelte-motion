<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Gauge, Layers, Zap } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import UseWillChangeDefault from '$lib/examples/use-will-change/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'useWillChange' }
        ]
    }
    if (seo) {
        seo.title = 'useWillChange | Examples | Svelte Motion'
        seo.description =
            'Auto-managed CSS will-change that starts at auto and latches to transform after a qualifying animation.'
        seo.ogTitle = 'useWillChange'
        seo.ogTagline = 'Promote once it animates, then stay latched'
        seo.ogFeatures = ['useWillChange', 'MotionValue', 'will-change', 'Performance']
        seo.ogSlug = 'examples-use-will-change'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'PERFORMANCE',
            title: { prefix: 'will-change, ', accent: 'only when needed', end: '.' },
            description:
                'The card starts at `will-change: auto`. Animating `x` flips it to `transform`, promoting it to its own compositor layer; once flipped it stays latched for subsequent animations.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'useWillChange' },
                { k: 'input', v: 'style={{ willChange }}' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}use-will-change/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <UseWillChangeDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Gauge />
            <span>
                The hook returns a MotionValue assigned to <code>style.willChange</code>, starting
                at
                <code>auto</code>.
            </span>
        </li>
        <li>
            <Zap />
            <span>
                When a transform (or accelerated) property animates, the runtime flips the value to
                <code>transform</code>.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                Non-transform animations (e.g. <code>backgroundColor</code>) leave it at
                <code>auto</code> — no needless layer promotion.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'use-will-change/demos/Default.svelte',
                'use-will-change-default',
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
