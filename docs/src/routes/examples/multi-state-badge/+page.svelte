<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Activity, Repeat, Sparkles } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import MultiStateBadgeDefault from '$lib/examples/multi-state-badge/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Multi-State Badge' }
        ]
    }
    if (seo) {
        seo.title = 'Multi-State Badge | Examples | Svelte Motion'
        seo.description =
            'A badge component that cycles through idle, processing, success, and error states with smooth animated transitions in Svelte Motion.'
        seo.ogTitle = 'Multi-State Badge'
        seo.h1 = { title: 'Multi-State Badge', mode: 'sr-only' }
        seo.ogTagline =
            'A badge component that cycles through idle, processing, success, and error states'
        seo.ogFeatures = [
            'State Machine',
            'Smooth Transitions',
            'Multiple States',
            'AnimatePresence'
        ]
        seo.ogSlug = 'examples-multi-state-badge'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'ANIMATE-PRESENCE',
            title: { prefix: 'multi-state ', accent: 'badge', end: '.' },
            description:
                'A badge that cycles `idle → processing → success → error → idle`. Click to advance. Each state swap exits and enters its icon + label inside `AnimatePresence`, with blur + scale carrying the transitions.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'state-cycle' }],
            sourceUrl: `${SOURCE_URL}multi-state-badge/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <MultiStateBadgeDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Repeat />
            <span>
                The badge holds an enum state (<code>idle</code>, <code>processing</code>,
                <code>success</code>, <code>error</code>) — clicking advances to the next via
                <code>getNextState()</code>. State change drives every animation downstream.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                Icon + label both live inside <code>AnimatePresence</code> keyed by state. Exit blurs
                and shrinks the outgoing content; enter blurs and grows the incoming content. Layout stays
                put because the badge chrome wraps the presence.
            </span>
        </li>
        <li>
            <Activity />
            <span>
                The composition lives in
                <code>$lib/examples/multi-state-badge/Badge.svelte</code> alongside icon helpers. The
                demo file is a thin wrapper that owns the state cycle — the animation lives in the badge
                components.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'multi-state-badge/demos/Default.svelte',
                'multi-state-badge-default',
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
