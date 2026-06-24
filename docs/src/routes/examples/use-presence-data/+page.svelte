<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { ArrowLeftRight, Layers, ScanEye } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import UsePresenceDataDefault from '$lib/examples/use-presence-data/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'usePresenceData' }
        ]
    }
    if (seo) {
        seo.title = 'usePresenceData | Examples | Svelte Motion'
        seo.description = 'Read AnimatePresence custom data from an entering or exiting child.'
        seo.ogTitle = 'usePresenceData'
        seo.h1 = { title: 'usePresenceData', mode: 'sr-only' }
        seo.ogTagline = 'Presence custom data inside exiting children'
        seo.ogFeatures = ['AnimatePresence', 'custom', 'usePresenceData', 'popLayout']
        seo.ogSlug = 'examples-use-presence-data'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'PRESENCE-DATA',
            title: { prefix: 'directional exits via ', accent: 'usePresenceData', end: '.' },
            description:
                'The parent passes `custom={direction}` to AnimatePresence. The keyed child reads that value with `usePresenceData()` so its enter and exit variants know which way to travel.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'usePresenceData' },
                { k: 'mode', v: 'popLayout' }
            ],
            sourceUrl: `${SOURCE_URL}use-presence-data/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <UsePresenceDataDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <ArrowLeftRight />
            <span>
                The controls update <code>direction</code> before the keyed slide changes.
            </span>
        </li>
        <li>
            <ScanEye />
            <span>
                The slide calls <code>usePresenceData()</code>, so it can read parent custom data
                while entering and while held for exit.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                <code>mode="popLayout"</code> lets the leaving slide pop out of layout while the new slide
                enters.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'use-presence-data/demos/Default.svelte',
                'use-presence-data-default',
                'Default.svelte'
            ),
            demoCodeSample(
                'use-presence-data/demos/PresenceDataSlide.svelte',
                'use-presence-data-slide',
                'PresenceDataSlide.svelte'
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
