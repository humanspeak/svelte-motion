<script lang="ts">
    import {
        CodeReferenceV2,
        type DemoManifestEntry,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Hash, ListChecks, Repeat } from '@lucide/svelte'
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
            'Cycle through animation variants in Svelte. useCycle returns a $state-backed { current, cycle } object for toggling motion states with Svelte 5 runes.'
        seo.ogTitle = 'useCycle'
        seo.ogTagline = 'Cycle through animation states'
        seo.ogFeatures = ['Variants', 'State Toggle', 'Svelte 5 Runes', 'SSR Safe']
        seo.ogSlug = 'examples-use-cycle'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const manifest = demoManifest as Record<string, DemoManifestEntry>

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'HOOK',
            title: { prefix: 'cycling ', accent: 'variants', end: '.' },
            description:
                '`useCycle(...labels)` returns a `{ current, cycle }` object. Read `variant.current` to drive `animate=`, call `variant.cycle()` to advance, or `variant.cycle(i)` to jump to a specific label. Pair it with a `variants` map and motion handles the transitions.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'finite-state cycle' }],
            sourceUrl: `${SOURCE_URL}use-cycle/demos/Default.svelte`
        }
    ]
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
                a separate selected-index <code>$state</code> cell.
            </span>
        </li>
        <li>
            <ListChecks />
            <span>
                The motion target reads
                <code>animate={'{variant.current}'}</code> (a string label), so motion resolves it
                via <code>variants</code>. Pure declarative: state lives in the cycle object,
                animations live in the variants map.
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
