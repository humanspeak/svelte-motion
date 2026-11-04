<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Gauge, Grid3x3, MoveRight } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import InertiaDefault from '$lib/examples/inertia/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'inertia' }]
    }
    if (seo) {
        seo.title = 'inertia | Svelte Motion'
        seo.description =
            'Fling a ball with the inertia generator: it decelerates, springs back off the wall, and can snap to a 50px grid.'
        seo.ogTitle = 'inertia'
        seo.h1 = { title: 'inertia', mode: 'sr-only' }
        seo.ogTagline = 'Coast, bounce, settle'
        seo.ogFeatures = ['inertia', 'Boundary Spring', 'modifyTarget']
        seo.ogSlug = 'examples-inertia'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/inertia/demos/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'INERTIA',
            title: { prefix: 'one velocity, ', accent: 'natural stop', end: '.' },
            description:
                'Each button flings the ball with a different velocity. Inertia decelerates it, and a spring pushes it back inside the track when it would cross the wall.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'inertia' },
                { k: 'input', v: 'transition.type' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <InertiaDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Gauge />
            <span>The ball travels <code>power × velocity</code> before it stops.</span>
        </li>
        <li>
            <MoveRight />
            <span><code>min</code>/<code>max</code> hand off to a boundary spring.</span>
        </li>
        <li>
            <Grid3x3 />
            <span><code>modifyTarget</code> snaps the resting point to a grid.</span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample('inertia/demos/Default.svelte', 'inertia-default', 'Default.svelte')
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
