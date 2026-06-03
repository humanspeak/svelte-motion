<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Anchor, Hand, MousePointer2 } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import LayoutScrollDefault from '$lib/examples/layout-scroll/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'layoutScroll' }
        ]
    }
    if (seo) {
        seo.title = 'layoutScroll — FLIP inside scroll containers | Examples | Svelte Motion'
        seo.description =
            'Use layoutScroll to keep FLIP layout animations anchored when the user scrolls the parent container mid-animation. Side-by-side demo of the drift vs the fix.'
        seo.ogTitle = 'layoutScroll'
        seo.ogTagline = 'Keep layout animations anchored across container scroll'
        seo.ogFeatures = ['FLIP layout', 'layoutScroll', 'Scroll containers', 'Anchored animations']
        seo.ogSlug = 'examples-layout-scroll'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'LAYOUTSCROLL',
            title: { prefix: 'anchored ', accent: 'inside scroll', end: '.' },
            description:
                'FLIP measures viewport-relative rects by default — scroll a parent container mid-animation and the offset leaks in as drift. Marking the scroll container with `layoutScroll` keeps measurements anchored.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'side-by-side comparison' }],
            sourceUrl: `${SOURCE_URL}layout-scroll/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <LayoutScrollDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Hand />
            <span>
                Click <strong>expand box</strong> — the FLIP runs over 1.8 s, plenty of time to
                experiment. <em>While the boxes are still animating</em>, drag the scrollbar of
                either panel down by ~80 px.
            </span>
        </li>
        <li>
            <MousePointer2 />
            <span>
                Left panel — the red box drifts as the FLIP transform fights the scroll offset. Same
                FLIP, no <code>layoutScroll</code>.
            </span>
        </li>
        <li>
            <Anchor />
            <span>
                Right panel — the teal box stays anchored in scroll-content space.
                <code>layoutScroll</code> tells FLIP to re-base measurements in the container's coordinate
                system, so a mid-animation scroll cancels out instead of leaking into the delta.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'layout-scroll/demos/Default.svelte',
                'layout-scroll-default',
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
