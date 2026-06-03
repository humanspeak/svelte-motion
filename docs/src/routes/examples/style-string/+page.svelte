<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Code2, Palette, Wand2 } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import StyleStringDefault from '$lib/examples/style-string/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'styleString' }
        ]
    }
    if (seo) {
        seo.title = 'styleString | Examples | Svelte Motion'
        seo.description =
            'Reactive style strings with automatic unit handling via the Svelte Motion styleString utility. Simplifies dynamic inline styles in components.'
        seo.ogTitle = 'styleString'
        seo.ogTagline =
            'Reactive style strings with automatic unit handling via the Svelte Motion styleString utility'
        seo.ogFeatures = ['Auto Units', 'Reactive CSS', 'Dynamic Styles', 'Style Objects']
        seo.ogSlug = 'examples-style-string'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'UTILITY',
            title: { prefix: 'reactive ', accent: 'styleString', end: '.' },
            description:
                '`styleString` turns a JS object into a CSS string. Pass a getter and reads of `$state` (or motion values) become reactive — adjust the sliders to drive transform + colour from a single object.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'styleString reactive' }],
            sourceUrl: `${SOURCE_URL}style-string/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <StyleStringDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Code2 />
            <span>
                <code>styleString({'{ rotate: 45, width: 120 }'})</code> emits
                <code>"transform: rotate(45deg); width: 120px;"</code> — numbers pick up the right unit
                for each property automatically.
            </span>
        </li>
        <li>
            <Wand2 />
            <span>
                Pass an object directly for one-shot styles, or a function for reactive ones — any
                <code>$state</code> read inside re-runs the conversion when state changes. Mix in
                motion values (<code>$autoRotate</code>) and the style string updates every frame.
            </span>
        </li>
        <li>
            <Palette />
            <span>
                Bonus: <code>style:</code> on a non-motion element accepts the string directly, so
                you don't need a <code>motion.*</code> wrapper just to drive reactive CSS — it's a general-purpose
                tool.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'style-string/demos/Default.svelte',
                'style-string-default',
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
