<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Grid3x3, LogOut, MoveHorizontal } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import GridExitDefault from '$lib/examples/grid-exit/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'Grid Exit' }]
    }
    if (seo) {
        seo.title = 'Grid Exit | Svelte Motion'
        seo.description =
            'Remove cards from a CSS grid with AnimatePresence exit animations that hold their slot until the exit finishes, then FLIP the surviving cards into place with the layout prop.'
        seo.ogTitle = 'Grid Exit'
        seo.h1 = { title: 'Grid Exit', mode: 'sr-only' }
        seo.ogTagline =
            'Exit a grid card in place, then slide the survivors into the freed slot — AnimatePresence + layout'
        seo.ogFeatures = ['Exit In Place', 'Slot Preservation', 'Sibling FLIP', 'Keyed Lists']
        seo.ogSlug = 'examples-grid-exit'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'GRID-EXIT',
            title: { prefix: 'exit in place, then ', accent: 'FLIP', end: ' the survivors.' },
            description:
                'A fixed 3-column processing strip. Each card combines `layout` with enter/exit animations inside `<AnimatePresence>`: completing a job fades its card out in the slot it currently occupies, and only then do the surviving cards slide over — one smooth FLIP, no snapping.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'exit + FLIP' }],
            sourceUrl: `${SOURCE_URL}grid-exit/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <GridExitDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <LogOut />
            <span>
                In the default <code>sync</code> mode, an exiting card keeps its grid slot until its
                <code>exit</code> animation finishes — the card fades out exactly where it stands, even
                when earlier removals have already moved it to a new column. Survivors don't reflow mid-exit.
            </span>
        </li>
        <li>
            <MoveHorizontal />
            <span>
                The <code>layout</code> prop does the second half: once the slot frees up, each surviving
                card FLIPs from its old column to its new one on the same spring — position is animated
                with transforms, so nothing repaints or stutters.
            </span>
        </li>
        <li>
            <Grid3x3 />
            <span>
                The cards render from a keyed <code>&#123;#each&#125;</code> with a stable
                <code>key</code> per job. Stable keys are what let
                <code>AnimatePresence</code> distinguish "this card left" from "every card changed" —
                without them, exits and FLIPs can't be attributed to the right element.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample('grid-exit/demos/Default.svelte', 'grid-exit-default', 'Default.svelte')
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
