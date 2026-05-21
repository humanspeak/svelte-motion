<script lang="ts">
    import {
        CodeReferenceV2,
        type DemoManifestEntry,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Activity, Palette, Type } from '@lucide/svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import CharactersRemainingDefault from '$lib/examples/characters-remaining/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Characters Remaining' }
        ]
    }
    if (seo) {
        seo.title = 'Characters Remaining | Examples | Svelte Motion'
        seo.description =
            'Character counter with spring-based bounce animation and color-mapped feedback built with Svelte Motion for smooth, reactive UI updates.'
        seo.ogTitle = 'Characters Remaining'
        seo.ogTagline =
            'Character counter with spring-based bounce animation and color-mapped feedback'
        seo.ogFeatures = ['Spring Bounce', 'Color Mapping', 'Reactive Updates', 'Visual Feedback']
        seo.ogSlug = 'examples-characters-remaining'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const manifest = demoManifest as Record<string, DemoManifestEntry>

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'TRANSFORM',
            title: { prefix: 'characters ', accent: 'remaining', end: '.' },
            description:
                'Type into the input. As you approach the 12-character limit the counter darkens through pink and the digit bounces — a `transform` value-mapper drives the colour, an imperative `animate()` spring keyed by the count drives the bounce.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'mapped-feedback' }],
            sourceUrl: `${SOURCE_URL}characters-remaining/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <CharactersRemainingDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Type />
            <span>
                <code>transform([from, to], [a, b])</code> builds a function that maps a numeric input
                to an interpolated output. The colour mapper here goes from pink at 2 left to muted grey
                at 6+ left — a smooth read of urgency without conditional CSS.
            </span>
        </li>
        <li>
            <Activity />
            <span>
                The spring fires from a <code>$effect</code> keyed by
                <code>charactersRemaining</code>. <code>velocity</code> scales with the count, so the
                bounce gets more energetic as the limit approaches and goes still when there's room to
                spare.
            </span>
        </li>
        <li>
            <Palette />
            <span>
                The counter's <code>color</code> is a regular reactive style; only the
                <code>scale</code> bounce is imperative because we want the spring to fire on value change,
                not just animate to a target.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'characters-remaining-default',
                label: 'Default.svelte',
                ...manifest['characters-remaining/demos/Default.svelte']
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
