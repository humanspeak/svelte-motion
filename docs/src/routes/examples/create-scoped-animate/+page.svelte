<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Box, Crosshair, Layers } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import ScopedDefault from '$lib/examples/create-scoped-animate/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'createScopedAnimate' }
        ]
    }
    if (seo) {
        seo.title = 'createScopedAnimate | Svelte Motion'
        seo.description =
            'Bind animate() to one element so a shared selector only moves the children inside it.'
        seo.ogTitle = 'createScopedAnimate'
        seo.h1 = { title: 'createScopedAnimate', mode: 'sr-only' }
        seo.ogTagline = 'One selector, one card'
        seo.ogFeatures = ['createScopedAnimate', 'Scoped Selectors', 'Springs']
        seo.ogSlug = 'examples-create-scoped-animate'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/create-scoped-animate/demos/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'SCOPE',
            title: { prefix: 'same selector, ', accent: 'one card', end: '.' },
            description:
                "Both cards hold .chip elements. The scoped animate resolves '.chip' inside the first card only, so the second card never moves.",
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'createScopedAnimate()' },
                { k: 'input', v: 'scope.current' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <ScopedDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Crosshair />
            <span>Selectors resolve inside <code>scope.current</code>, not the document.</span>
        </li>
        <li>
            <Layers />
            <span>Started animations are pushed onto <code>scope.animations</code>.</span>
        </li>
        <li>
            <Box />
            <span><code>useAnimate()</code> is built on the same factory.</span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'create-scoped-animate/demos/Default.svelte',
                'create-scoped-animate-default',
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
