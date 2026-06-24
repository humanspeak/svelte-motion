<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Boxes, Palette, Route } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import ObjectStyleMotionValuesDefault from '$lib/examples/object-style-motion-values/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Object style MotionValues' }
        ]
    }
    if (seo) {
        seo.title = 'Object style MotionValues | Examples | Svelte Motion'
        seo.description = 'Drive object-form style props with live MotionValues.'
        seo.ogTitle = 'Object style MotionValues'
        seo.h1 = { title: 'Object style MotionValues', mode: 'sr-only' }
        seo.ogTagline = 'MotionValue interpolation directly inside style objects'
        seo.ogFeatures = ['MotionValue', 'Style Objects', 'Transforms', 'CSS Variables']
        seo.ogSlug = 'examples-object-style-motion-values'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'MOTION-VALUE',
            title: { prefix: 'style objects can ', accent: 'carry MotionValues', end: '.' },
            description:
                'One progress MotionValue derives transform shortcuts, opacity, color, box-shadow, and a CSS variable directly inside the style object. Static entries render immediately; live entries update through motion-dom.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'style={{ x, opacity }}' },
                { k: 'effect', v: 'motion-dom' }
            ],
            sourceUrl: `${SOURCE_URL}object-style-motion-values/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <ObjectStyleMotionValuesDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Route />
            <span>
                Transform shortcuts like <code>x</code>, <code>y</code>, <code>rotate</code>, and
                <code>scale</code> are composed by Motion's style effect.
            </span>
        </li>
        <li>
            <Palette />
            <span>
                Non-transform properties like <code>backgroundColor</code> and
                <code>boxShadow</code> can be MotionValues too.
            </span>
        </li>
        <li>
            <Boxes />
            <span>
                Static object entries such as <code>width</code> and <code>height</code> render with the
                initial markup, so the first paint is stable.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'object-style-motion-values/demos/Default.svelte',
                'object-style-motion-values-default',
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
