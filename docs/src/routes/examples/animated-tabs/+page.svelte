<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { Boxes, MoveHorizontal, Sparkles } from '@lucide/svelte'
    import type { Snippet } from 'svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import AnimatedTabsDefault from '$lib/examples/animated-tabs/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Animated Tabs' }
        ]
    }
    if (seo) {
        seo.title = 'Animated Tabs | Examples | Svelte Motion'
        seo.description =
            'Spring-based animated tabs with a sliding indicator powered by svelte-motion layoutId and bits-ui.'
        seo.ogTitle = 'Animated Tabs'
        seo.ogTagline =
            'Spring-based animated tabs with a sliding indicator powered by svelte-motion layoutId'
        seo.ogFeatures = ['layoutId', 'Sliding Indicator', 'Spring Physics', 'bits-ui']
        seo.ogSlug = 'examples-animated-tabs'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    type Section = {
        figId: string
        tag: string
        title: { prefix?: string; accent: string; end?: string }
        description: string
        snippet: Snippet
        codeSnippet?: Snippet
        notes?: Snippet
        mode?: 'live' | 'static'
        barCells?: { k: string; v: string }[]
        sourceUrl?: string
    }

    type ManifestEntry = {
        code: string
        lang: string
        html?: { light: string; dark: string }
    }
    const manifest = demoManifest as Record<string, ManifestEntry>

    const sections: Section[] = [
        {
            figId: 'FIG-001',
            tag: 'LAYOUTID',
            title: { prefix: 'animated ', accent: 'tabs', end: '.' },
            description:
                'A shared `layoutId` on the active indicator slides it between tab triggers with spring physics. State management stays on bits-ui; animation stays on svelte-motion.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'tabs-sliding-indicator' }],
            sourceUrl: `${SOURCE_URL}animated-tabs/demos/Default.svelte`
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

{#snippet defaultSection()}
    <AnimatedTabsDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <MoveHorizontal />
            <span>
                The active-tab indicator carries a shared <code>layoutId</code> across all triggers —
                when the active tab changes, motion animates the indicator from the old position to the
                new one.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                Tab content fades through <code>AnimatePresence</code> so switching panels reads as a
                state change, not a hard cut.
            </span>
        </li>
        <li>
            <Boxes />
            <span>
                Composed on top of bits-ui's <code>Tabs.Root</code> — bits-ui owns the state machine
                + keyboard accessibility, svelte-motion owns the animation. Add
                <code>animated={false}</code> on the root to fall back to vanilla shadcn behaviour.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'animated-tabs-default',
                label: 'Default.svelte',
                ...manifest['animated-tabs/demos/Default.svelte']
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
        sheetLabel="SHEET {pad2(i + 1)} / {pad2(sections.length)}"
        barCells={section.barCells}
        sourceUrl={section.sourceUrl}
        codeSnippet={section.codeSnippet}
        codeLabel="show code"
        notes={section.notes}
    >
        {@render section.snippet()}
    </ExampleV2>
{/each}
