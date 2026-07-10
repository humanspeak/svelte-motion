<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import {
        Layers,
        MousePointerClick,
        Radius,
        Sparkles,
        SlidersHorizontal,
        Zap
    } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import ViewFilterGallery from '$lib/examples/view/demos/FilterGallery.svelte'
    import ViewSharedElement from '$lib/examples/view/demos/SharedElement.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'View Transitions' }
        ]
    }
    if (seo) {
        seo.title = 'View Transitions | Svelte Motion'
        seo.description =
            'Shared-element morphs and filtered galleries with animateView — the browser View Transitions API driven by Motion timing.'
        seo.ogTitle = 'View Transitions'
        seo.h1 = { title: 'View Transitions', mode: 'sr-only' }
        seo.ogTagline = 'Shared-element morphs with the native View Transitions API'
        seo.ogFeatures = [
            'Shared Element Morphs',
            'Enter/Exit Layers',
            'Spring Timing',
            'Native Browser API'
        ]
        seo.ogSlug = 'examples-view'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'MORPH',
            title: { prefix: 'shared-element ', accent: 'morphs', end: '.' },
            description:
                'The "now playing" pattern: click a tile and it morphs into the detail hero — two different elements paired into one view-transition layer with .add(thumb, hero). Closing morphs it back.',
            snippet: sharedSection,
            codeSnippet: sharedCode,
            notes: sharedNotes,
            barCells: [{ k: 'pattern', v: 'add-pair' }],
            sourceUrl: `${SOURCE_URL}view/demos/SharedElement.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'ENTER/EXIT',
            title: { prefix: 'filtering with ', accent: 'view layers', end: '.' },
            description:
                'Filtering the grid inside animateView: surviving shapes glide to their new slots while entering and leaving shapes scale-fade through .enter() and .exit().',
            snippet: filterSection,
            codeSnippet: filterCode,
            notes: filterNotes,
            barCells: [{ k: 'pattern', v: 'enter-exit' }],
            sourceUrl: `${SOURCE_URL}view/demos/FilterGallery.svelte`
        }
    ]
</script>

{#snippet sharedSection()}
    <ViewSharedElement />
{/snippet}
{#snippet sharedNotes()}
    <ul>
        <li>
            <MousePointerClick />
            <span>
                <code>animateView(update)</code> snapshots the page, runs the update — Svelte
                <code>$state</code> mutations are flushed synchronously, so plain assignment works — then
                animates between snapshots.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                <code>.add(oldTarget, newTarget)</code> pairs two different elements into one layer: the
                first resolves in the old snapshot, the second in the new one, and the browser morphs
                between them. Names are generated and cleaned up automatically.
            </span>
        </li>
        <li>
            <Radius />
            <span>
                Both endpoints share a <em>percentage</em> <code>border-radius</code>: snapshots
                bake rounding in as transparency, so proportional radii keep the silhouettes
                coincident at every scale — no corner ghosting mid-morph.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet sharedCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'view/demos/SharedElement.svelte',
                'view-shared-element',
                'SharedElement.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet filterSection()}
    <ViewFilterGallery />
{/snippet}
{#snippet filterNotes()}
    <ul>
        <li>
            <Layers />
            <span>
                <code>.add('[data-view-item]')</code> registers every matched element — items present
                in both snapshots morph to their new grid slots automatically.
            </span>
        </li>
        <li>
            <Zap />
            <span>
                <code>.enter()</code> animates pure newcomers and <code>.exit()</code> pure leavers;
                survivors get neither, they just morph. <code>.new()</code>/<code>.old()</code> are the
                ungated variants for crossfades on surviving layers.
            </span>
        </li>
        <li>
            <SlidersHorizontal />
            <span>
                Rapid filter clicks queue behind the in-flight transition (<code
                    >interrupt: 'wait'</code
                >, the default) — pass
                <code>interrupt: 'immediate'</code> to skip ahead instead.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet filterCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'view/demos/FilterGallery.svelte',
                'view-filter-gallery',
                'FilterGallery.svelte'
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
