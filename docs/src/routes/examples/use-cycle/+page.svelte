<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { Hash, ListChecks, Repeat } from '@lucide/svelte'
    import type { Snippet } from 'svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import UseCycleDefault from '$lib/examples/use-cycle/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'useCycle' }]
    }
    if (seo) {
        seo.title = 'useCycle | Examples | Svelte Motion'
        seo.description =
            'Cycle through animation variants in Svelte. useCycle returns a reactive store and a cycle function for toggling motion states.'
        seo.ogTitle = 'useCycle'
        seo.ogTagline = 'Cycle through animation states'
        seo.ogFeatures = ['Variants', 'State Toggle', 'Reactive Store', 'SSR Safe']
        seo.ogSlug = 'examples-use-cycle'
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
            tag: 'HOOK',
            title: { prefix: 'cycling ', accent: 'variants', end: '.' },
            description:
                '`useCycle(...labels)` returns `[current, cycle]`. `cycle()` advances by one; `cycle(i)` jumps. Pair it with a `variants` map keyed by the same labels and motion handles the transitions for free.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'finite-state cycle' }],
            sourceUrl: `${SOURCE_URL}use-cycle/demos/Default.svelte`
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

{#snippet defaultSection()}
    <UseCycleDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Repeat />
            <span>
                <code>cycle()</code> with no args advances to the next label, wrapping around at the end.
                It's the simplest way to build a multi-state toggle without writing your own modulo arithmetic.
            </span>
        </li>
        <li>
            <Hash />
            <span>
                <code>cycle(i)</code> jumps directly to the label at index <code>i</code>. Useful
                for tab-bar-style controls where each button maps to a specific state — no need for
                a separate selected-index <code>$state</code>.
            </span>
        </li>
        <li>
            <ListChecks />
            <span>
                The motion target reads <code>animate={'{$variant}'}</code> (a string label), so
                motion resolves it via <code>variants</code>. Pure declarative: state lives in the
                cycle store, animations live in the variants map.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'use-cycle-default',
                label: 'Default.svelte',
                ...manifest['use-cycle/demos/Default.svelte']
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
