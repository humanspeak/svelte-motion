<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { GitMerge, Network, Timer } from '@lucide/svelte'
    import type { Snippet } from 'svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import VariantsPropagationDefault from '$lib/examples/variants-propagation/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Variants Propagation' }
        ]
    }
    if (seo) {
        seo.title = 'Variants Propagation | Examples | Svelte Motion'
        seo.description =
            'Propagate variant animations through nested component trees with Svelte Motion. Parent state changes automatically cascade to child elements.'
        seo.ogTitle = 'Variants Propagation'
        seo.ogTagline =
            'Propagate variant animations through nested component trees with Svelte Motion'
        seo.ogFeatures = ['Parent Cascade', 'Nested Trees', 'Auto Propagation', 'Variant States']
        seo.ogSlug = 'examples-variants-propagation'
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
            tag: 'VARIANTS',
            title: { prefix: 'variant ', accent: 'cascade', end: '.' },
            description:
                "Parent's `animate` flows through the descendant tree. Each child looks up the same label in its own `variants` map — one boolean, an orchestrated cascade.",
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'parent → children' }],
            sourceUrl: `${SOURCE_URL}variants-propagation/demos/Default.svelte`
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

{#snippet defaultSection()}
    <VariantsPropagationDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <GitMerge />
            <span>
                The parent <code>motion.ul</code> sets
                <code>animate={'{isVisible ? "visible" : "hidden"}'}</code>. Motion walks the
                descendant <code>motion.*</code> tree and runs the same label on each — children
                only need to register their own definitions in <code>variants</code>.
            </span>
        </li>
        <li>
            <Network />
            <span>
                The container variant only animates opacity; items animate opacity + x. Different
                shapes, same label — motion applies whatever each variant declares. Useful for
                broadcasting a "state" without coupling parent + child styles.
            </span>
        </li>
        <li>
            <Timer />
            <span>
                Per-element <code>transition</code> objects compose with the cascade.
                <code>delay: i * 0.1</code> on each <code>motion.li</code> staggers the entrance without
                any orchestration logic at the parent.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'variants-propagation-default',
                label: 'Default.svelte',
                ...manifest['variants-propagation/demos/Default.svelte']
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
