<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Layers, Lock, Shuffle } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import LayoutGroupDefault from '$lib/examples/layout-group/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'LayoutGroup' }
        ]
    }
    if (seo) {
        seo.title = 'LayoutGroup — scope shared-layout animations | Examples | Svelte Motion'
        seo.description =
            'Wrap regions in <LayoutGroup id> to keep identical layoutId values in sibling subtrees from cross-animating. Side-by-side tab strips demo.'
        seo.ogTitle = 'LayoutGroup'
        seo.ogTagline = 'Scope shared-layout animations to a subtree'
        seo.ogFeatures = ['Shared layout', 'LayoutGroup', 'layoutId scoping', 'Tab strips']
        seo.ogSlug = 'examples-layout-group'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'LAYOUTGROUP',
            title: { prefix: 'scoped ', accent: 'layoutId', end: '.' },
            description:
                'Two sibling tab strips share `layoutId="underline"`. Each strip lives in its own `<LayoutGroup id>` so the underline animation stays scoped — clicking a tab in one strip never pulls the underline from the other.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'scoped shared-layout' }],
            sourceUrl: `${SOURCE_URL}layout-group/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <LayoutGroupDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Layers />
            <span>
                Same <code>layoutId="underline"</code> appears in <strong>both</strong> tab strips.
                Without scoping, the underline would jump between strips because
                <code>motion</code> looks up <code>layoutId</code> on a single global registry.
            </span>
        </li>
        <li>
            <Lock />
            <span>
                Wrapping each strip in <code>&lt;LayoutGroup id="strip-a"&gt;</code> /
                <code>id="strip-b"</code> prefixes the registry key —
                <code>strip-a::underline</code> vs <code>strip-b::underline</code> — so the two animations
                never see each other.
            </span>
        </li>
        <li>
            <Shuffle />
            <span>
                Click tabs across both strips: the underline always slides within its own strip. Try
                removing the <code>&lt;LayoutGroup&gt;</code> wrappers locally and the underline will
                jump across the page on every click.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'layout-group/demos/Default.svelte',
                'layout-group-default',
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
