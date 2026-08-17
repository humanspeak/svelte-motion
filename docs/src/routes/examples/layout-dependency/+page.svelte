<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { ArrowUpToLine, Gauge, Layers, ListOrdered, Zap } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import LayoutDependencyDefault from '$lib/examples/layout-dependency/demos/Default.svelte'
    import LayoutDependencyKeyedList from '$lib/examples/layout-dependency/demos/KeyedList.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'layoutDependency' }
        ]
    }
    if (seo) {
        seo.title = 'layoutDependency | Svelte Motion'
        seo.description =
            'Gate layout measurement so FLIP only recomputes when a dependency changes.'
        seo.ogTitle = 'layoutDependency'
        seo.h1 = { title: 'layoutDependency', mode: 'sr-only' }
        seo.ogTagline = 'Re-measure only when it matters'
        seo.ogFeatures = ['layoutDependency', 'Layout Animations', 'FLIP', 'Performance']
        seo.ogSlug = 'examples-layout-dependency'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'LAYOUT',
            title: { prefix: 'frequent renders, ', accent: 'gated measurement', end: '.' },
            description:
                'Both boxes have `layout` and re-render constantly (their color cycles). The left box re-measures on every render; the right box passes `layoutDependency={dep}`, so it only re-measures when `dep` changes — watch its counter stay flat.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'layoutDependency' },
                { k: 'input', v: 'layout' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}layout-dependency/demos/Default.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'LAYOUT',
            title: { prefix: 'keyed list, ', accent: 'what to gate on', end: '.' },
            description:
                'Rows are `layout="position"` in a keyed `{#each}` sorted by activity. Gated on a per-row field, only the bumped row animates and the rows it displaces jump — upstream parity. Gate on the row index and every moved row slides.',
            snippet: keyedListSection,
            codeSnippet: keyedListCode,
            notes: keyedListNotes,
            barCells: [
                { k: 'api', v: 'layoutDependency' },
                { k: 'input', v: 'keyed each' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}layout-dependency/demos/KeyedList.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <LayoutDependencyDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Zap />
            <span>
                Every render recolors both boxes — a stand-in for live text or streaming values that
                re-render a <code>layout</code> element often.
            </span>
        </li>
        <li>
            <Gauge />
            <span>
                The gated box passes <code>layoutDependency={'{dep}'}</code>, so its measure counter
                only moves when <code>dep</code> changes on Reflow.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                Both still FLIP-animate to their new position on Reflow — gating skips the wasted
                measurements, not the real ones.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'layout-dependency/demos/Default.svelte',
                'layout-dependency-default',
                'Default.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet keyedListSection()}
    <LayoutDependencyKeyedList />
{/snippet}
{#snippet keyedListNotes()}
    <ul>
        <li>
            <ArrowUpToLine />
            <span>
                Bumping a row re-sorts the list. With <code>layoutDependency={'{row.ts}'}</code>
                only that row's dependency changed, so only it FLIPs — the displaced rows jump, exactly
                as upstream <code>MeasureLayout</code> behaves.
            </span>
        </li>
        <li>
            <ListOrdered />
            <span>
                Switch to <code>layoutDependency={'{i}'}</code>: the index changes for every row
                whose slot changed, so every moved row animates and untouched rows stay gated.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                Don't need the gate in a list? Omit <code>layoutDependency</code> and every reorder animates
                every row.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet keyedListCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'layout-dependency/demos/KeyedList.svelte',
                'layout-dependency-keyed-list',
                'KeyedList.svelte'
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
