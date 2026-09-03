<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Gauge, Layers, Wand } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import CustomEffectsDefault from '$lib/examples/custom-effects/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Custom Effects' }
        ]
    }
    if (seo) {
        seo.title = 'Custom Effects | Svelte Motion'
        seo.description =
            'Animate any JavaScript object — a canvas dial driven by createEffect and animate.addEffect.'
        seo.ogTitle = 'Custom Effects'
        seo.h1 = { title: 'Custom Effects', mode: 'sr-only' }
        seo.ogTagline = 'Motion springs beyond the DOM'
        seo.ogFeatures = ['createEffect', 'animate.addEffect', 'Canvas', 'Plain Objects']
        seo.ogSlug = 'examples-custom-effects'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/custom-effects/demos/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'EFFECT',
            title: { prefix: 'plain object, ', accent: 'full Motion physics', end: '.' },
            description:
                'A custom effect claims a plain dial object and writes its animated values before a canvas render loop draws each frame.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'createEffect' },
                { k: 'input', v: 'animate.addEffect' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <CustomEffectsDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Wand />
            <span><code>createEffect</code> teaches Motion how to read and write the dial.</span>
        </li>
        <li>
            <Gauge />
            <span
                >The same <code>animate()</code> call applies spring physics to a plain object.</span
            >
        </li>
        <li>
            <Layers />
            <span><code>frame.preRender</code> writes values before the canvas draws.</span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'custom-effects/demos/Default.svelte',
                'custom-effects-default',
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
