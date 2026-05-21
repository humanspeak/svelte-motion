<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { Anchor, ArrowLeftRight, Layers } from '@lucide/svelte'
    import type { Snippet } from 'svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import SharedLayoutAnimationDefault from '$lib/examples/shared-layout-animation/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Shared Layout Animation' }
        ]
    }
    if (seo) {
        seo.title = 'Shared Layout Animation | Examples | Svelte Motion'
        seo.description =
            'Animate elements between positions using layoutId for smooth shared layout transitions in Svelte Motion.'
        seo.ogTitle = 'Shared Layout Animation'
        seo.ogTagline =
            'Animate elements between positions using layoutId for smooth shared layout transitions'
        seo.ogFeatures = ['layoutId', 'FLIP Animation', 'Shared Transitions', 'Position Morph']
        seo.ogSlug = 'examples-shared-layout-animation'
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
            title: { prefix: 'shared ', accent: 'layoutId', end: '.' },
            description:
                'Each tab renders its own underline `motion.div`, but they all share `layoutId="underline"`. When one mounts as another unmounts, motion treats them as the same element and tweens between positions.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'layoutId tab indicator' }],
            sourceUrl: `${SOURCE_URL}shared-layout-animation/demos/Default.svelte`
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

{#snippet defaultSection()}
    <SharedLayoutAnimationDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Anchor />
            <span>
                Each tab conditionally renders its own
                <code>&lt;motion.div layoutId="underline" /&gt;</code> when active. The shared
                <code>layoutId</code> tells motion these are the same element — it measures the outgoing
                rect, mounts the new one, and tweens between them with a spring.
            </span>
        </li>
        <li>
            <ArrowLeftRight />
            <span>
                The content area uses
                <code>AnimatePresence mode="wait"</code>: the previous emoji exits fully before the
                next one enters, so the two never overlap during the swap.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                The tabs themselves animate their <code>backgroundColor</code> via
                <code>animate={'{ backgroundColor: … }'}</code> — no variants needed because each
                cell decides its own state from <code>selectedTab</code>.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'shared-layout-animation-default',
                label: 'Default.svelte',
                ...manifest['shared-layout-animation/demos/Default.svelte']
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
