<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { Layers, ScanEye, Timer } from '@lucide/svelte'
    import type { Snippet } from 'svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import UsePresenceDefault from '$lib/examples/use-presence/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'usePresence' }
        ]
    }
    if (seo) {
        seo.title = 'usePresence | Examples | Svelte Motion'
        seo.description =
            'Custom exit animations from inside the child. PresenceChild holds the component rendered until your safeToRemove() fires.'
        seo.ogTitle = 'usePresence'
        seo.ogTagline = 'Custom exit animations from the child'
        seo.ogFeatures = ['Custom Exit', 'PresenceChild', 'safeToRemove', 'AnimatePresence']
        seo.ogSlug = 'examples-use-presence'
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
            tag: 'ANIMATE-PRESENCE',
            title: { prefix: 'custom exit via ', accent: 'usePresence', end: '.' },
            description:
                '`<PresenceChild present={…}>` keeps the card rendered after `present` flips false. Inside, `usePresence` hands the card a `safeToRemove` callback — the card runs its own CSS transition and releases the wrapper on `transitionend`.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'PresenceChild + safeToRemove' }],
            sourceUrl: `${SOURCE_URL}use-presence/demos/Default.svelte`
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

{#snippet defaultSection()}
    <UsePresenceDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Layers />
            <span>
                <code>PresenceChild</code> holds the child rendered while the surrounding
                <code>AnimatePresence</code> is exiting it. The card stays in the DOM with
                <code>isPresent === false</code> until <code>safeToRemove()</code> fires.
            </span>
        </li>
        <li>
            <ScanEye />
            <span>
                Inside the card, <code>usePresence()</code> returns
                <code>[isPresent, safeToRemove]</code>. The effect listens for
                <code>transitionend</code> on the card node and calls
                <code>safeToRemove</code> once the CSS transition completes — fully custom exit under
                the component's own control.
            </span>
        </li>
        <li>
            <Timer />
            <span>
                Re-entering (clicking <em>Show</em> mid-exit) cancels the hold; the stale
                <code>safeToRemove</code> becomes a no-op so a late
                <code>transitionend</code> can't tear down a now-present card.
                <code>onExitComplete</code> on the parent tallies finished exits.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'use-presence-default',
                label: 'Default.svelte',
                ...manifest['use-presence/demos/Default.svelte']
            },
            {
                id: 'use-presence-card',
                label: 'UsePresenceCard.svelte',
                ...manifest['use-presence/demos/UsePresenceCard.svelte']
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
