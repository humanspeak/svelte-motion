<script lang="ts">
    import {
        CodeReferenceV2,
        type DemoManifestEntry,
        ExampleV2,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { ArrowLeftRight, Layers, SquareStack } from '@lucide/svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import AnimatePresenceCustomDefault from '$lib/examples/animate-presence-custom/demos/Default.svelte'
    import AnimatePresenceCustomUsePresenceData from '$lib/examples/animate-presence-custom/demos/UsePresenceData.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'AnimatePresence custom' }
        ]
    }
    if (seo) {
        seo.title = 'AnimatePresence custom | Examples | Svelte Motion'
        seo.description =
            'Directional exit animations powered by AnimatePresence custom data and dynamic variants.'
        seo.ogTitle = 'AnimatePresence custom'
        seo.ogTagline = 'Directional exits from parent presence data'
        seo.ogFeatures = ['AnimatePresence', 'custom', 'Dynamic Variants', 'Directional Exit']
        seo.ogSlug = 'examples-animate-presence-custom'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const manifest = demoManifest as Record<string, DemoManifestEntry>

    const sections = [
        {
            figId: 'FIG-001',
            tag: 'PRESENCE',
            title: { prefix: 'directional exits with ', accent: 'custom data', end: '.' },
            description:
                '`<AnimatePresence custom={direction}>` forwards the latest direction into exiting dynamic variants. The leaving card can move left or right even after it has been removed from Svelte state.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'exit data', v: 'presence custom' }],
            sourceUrl: `${SOURCE_URL}animate-presence-custom/demos/Default.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'UPSTREAM',
            title: { prefix: 'Motion canonical ', accent: 'usePresenceData', end: '.' },
            description:
                'This mirrors Motion’s published example: the parent passes `custom={direction}` and the exiting slide reads that value with `usePresenceData()`.',
            snippet: upstreamSection,
            codeSnippet: upstreamCode,
            notes: upstreamNotes,
            barCells: [
                { k: 'api', v: 'usePresenceData' },
                { k: 'mode', v: 'popLayout' }
            ],
            sourceUrl: `${SOURCE_URL}animate-presence-custom/demos/UsePresenceData.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <AnimatePresenceCustomDefault />
{/snippet}
{#snippet upstreamSection()}
    <AnimatePresenceCustomUsePresenceData />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <ArrowLeftRight />
            <span>
                The parent updates <code>direction</code> before swapping the keyed child.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                The exiting child resolves <code>exit</code> with <code>AnimatePresence</code>
                custom data, matching upstream Motion.
            </span>
        </li>
        <li>
            <SquareStack />
            <span>
                The child has intentionally stale <code>custom</code> data to prove the parent presence
                value wins during exit.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet upstreamNotes()}
    <ul>
        <li>
            <ArrowLeftRight />
            <span>
                The controls update <code>direction</code>, then wrap the selected item.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                The slide calls <code>usePresenceData()</code> to read the latest
                <code>AnimatePresence</code> custom value.
            </span>
        </li>
        <li>
            <SquareStack />
            <span>
                <code>mode="popLayout"</code> pops the exiting square out while the next one enters.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'animate-presence-custom-default',
                label: 'Default.svelte',
                ...manifest['animate-presence-custom/demos/Default.svelte']
            }
        ]}
        columns={1}
    />
{/snippet}
{#snippet upstreamCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'animate-presence-custom-use-presence-data',
                label: 'UsePresenceData.svelte',
                ...manifest['animate-presence-custom/demos/UsePresenceData.svelte']
            },
            {
                id: 'animate-presence-custom-presence-data-slide',
                label: 'PresenceDataSlide.svelte',
                ...manifest['animate-presence-custom/demos/PresenceDataSlide.svelte']
            }
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
