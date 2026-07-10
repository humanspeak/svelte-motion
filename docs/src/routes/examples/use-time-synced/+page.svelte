<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { GitBranch, Link, Share2 } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import UseTimeSyncedDefault from '$lib/examples/use-time-synced/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'useTime (Synced)' }
        ]
    }
    if (seo) {
        seo.title = 'useTime (Synced) | Svelte Motion'
        seo.description =
            'Synchronized time-based animations across multiple elements using a shared Svelte Motion useTime store for coordinated motion effects.'
        seo.ogTitle = 'useTime (Synced)'
        seo.h1 = { title: 'useTime (Synced)', mode: 'sr-only' }
        seo.ogTagline =
            'Synchronized time-based animations across multiple elements using a shared useTime store'
        seo.ogFeatures = ['Shared Store', 'Synchronized', 'Multi-Element', 'Coordinated Motion']
        seo.ogSlug = 'examples-use-time-synced'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'HOOK',
            title: { prefix: 'shared ', accent: 'timeline', end: '.' },
            description:
                '`useTime(key)` returns the same motion value for every caller passing the same key. Two independent components stay locked in phase without a shared store — perfect for orchestrating ambient motion across disjoint subtrees.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'keyed shared clock' }],
            sourceUrl: `${SOURCE_URL}use-time-synced/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <UseTimeSyncedDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Link />
            <span>
                Both elements call <code>useTime('synced-timeline')</code>. Motion looks the key up
                in a registry — first call creates the clock, every subsequent call gets the same
                store. Identical ticks, no prop-drilling.
            </span>
        </li>
        <li>
            <GitBranch />
            <span>
                Each side derives its own animations from the shared time value. Same period, same
                phase — element A and element B rotate in lockstep even though their derived stores
                are unrelated.
            </span>
        </li>
        <li>
            <Share2 />
            <span>
                Skip the key (<code>useTime()</code>) for a per-component clock when you want
                independence. Use a key when you want different parts of the page — different
                routes, even — to share a heartbeat.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'use-time-synced/demos/Default.svelte',
                'use-time-synced-default',
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
