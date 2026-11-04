<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Anchor, ArrowLeftRight, Layers } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import PresenceCrossfadeDefault from '$lib/examples/presence-crossfade/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Presence Crossfade' }
        ]
    }
    if (seo) {
        seo.title = 'Presence Crossfade | Svelte Motion'
        seo.description =
            'A card that closes back into its thumbnail: exiting layoutId elements crossfade with AnimatePresence in Svelte Motion.'
        seo.ogTitle = 'Presence Crossfade'
        seo.h1 = { title: 'Presence Crossfade', mode: 'sr-only' }
        seo.ogTagline = 'Exiting layoutId elements crossfade into the element that takes over'
        seo.ogFeatures = ['layoutId', 'AnimatePresence', 'Crossfade', 'present + child']
        seo.ogSlug = 'examples-presence-crossfade'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'LAYOUTID',
            title: { prefix: 'close into the ', accent: 'thumbnail', end: '.' },
            description:
                'The card is the `present` + `child` child of `AnimatePresence`. When it closes it is relegated: the thumbnail takes its `layoutId` back and grows out of it, while the card stays mounted and fades out until that animation ends.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'layoutId + AnimatePresence' }],
            sourceUrl: `${SOURCE_URL}presence-crossfade/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <PresenceCrossfadeDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Anchor />
            <span>
                Each thumbnail and the card share a <code>layoutId</code>: opening the card makes it
                the lead, so it grows out of its thumbnail.
            </span>
        </li>
        <li>
            <ArrowLeftRight />
            <span>
                Closing relegates the card. The thumbnail takes over and grows out of it, and the
                card crossfades out. It stays mounted until the shared animation ends, with no
                <code>exit</code> prop, as in Motion.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                A snippet reads live state, so the card reads <code>shown</code>, the colour latched
                while it was open, instead of <code>open</code>, which is <code>null</code> while it closes.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'presence-crossfade/demos/Default.svelte',
                'presence-crossfade-default',
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
