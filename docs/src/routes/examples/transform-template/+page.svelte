<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Layers, Route, Wand } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import TransformTemplateDefault from '$lib/examples/transform-template/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'transformTemplate' }
        ]
    }
    if (seo) {
        seo.title = 'transformTemplate | Examples | Svelte Motion'
        seo.description = 'Customize generated Motion transform strings with transformTemplate.'
        seo.ogTitle = 'transformTemplate'
        seo.ogTagline = 'Reshape generated transform strings'
        seo.ogFeatures = [
            'transformTemplate',
            'MotionValue',
            'Transform Shortcuts',
            'Style Objects'
        ]
        seo.ogSlug = 'examples-transform-template'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'TRANSFORM',
            title: { prefix: 'generated transforms, ', accent: 'custom order', end: '.' },
            description:
                'The payload still uses Motion shorthand `x`. transformTemplate receives the generated `translateX(...)` string and adds a matching vertical lift plus skew before writing the final CSS transform.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'transformTemplate' },
                { k: 'input', v: 'style={{ x }}' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}transform-template/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <TransformTemplateDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Route />
            <span>
                The card's <code>x</code> MotionValue generates the normal horizontal
                <code>translateX(...)</code> transform.
            </span>
        </li>
        <li>
            <Wand />
            <span>
                The template uses that same latest <code>x</code> value to add lift and skew before the
                generated transform.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                Because the template owns the final string, transform order stays explicit and
                inspectable.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'transform-template/demos/Default.svelte',
                'transform-template-default',
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
