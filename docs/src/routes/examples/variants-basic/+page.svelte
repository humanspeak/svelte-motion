<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { BookOpen, Repeat2, Tags } from '@lucide/svelte'
    import type { Snippet } from 'svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import VariantsBasicDefault from '$lib/examples/variants-basic/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Variants Basic' }
        ]
    }
    if (seo) {
        seo.title = 'Variants Basic | Examples | Svelte Motion'
        seo.description =
            'Define and switch between named animation states with Svelte Motion variants. Create reusable, declarative animation presets for components.'
        seo.ogTitle = 'Variants Basic'
        seo.ogTagline =
            'Define and switch between named animation states with Svelte Motion variants'
        seo.ogFeatures = ['Named States', 'Declarative', 'Reusable Presets', 'State Switching']
        seo.ogSlug = 'examples-variants-basic'
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
            title: { prefix: 'named ', accent: 'variants', end: '.' },
            description:
                'A `variants` map gives you named animation states. Pass the label string to `animate` and motion looks it up and tweens there — the workhorse pattern for any binary toggle.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'open/closed toggle' }],
            sourceUrl: `${SOURCE_URL}variants-basic/demos/Default.svelte`
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

{#snippet defaultSection()}
    <VariantsBasicDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Tags />
            <span>
                Each variant is an animation target object keyed by a label. The shape is identical
                to what you'd pass to <code>animate={'{ opacity, scale, … }'}</code> directly — variants
                are just a way to name those targets.
            </span>
        </li>
        <li>
            <Repeat2 />
            <span>
                <code>animate={'{isOpen ? "open" : "closed"}'}</code> swaps between labels. Motion tweens
                between the two variant objects automatically — no need to spread the props manually or
                duplicate the transition config.
            </span>
        </li>
        <li>
            <BookOpen />
            <span>
                The real power kicks in when the parent's variant cascades into descendants — every
                child <code>motion.*</code> with matching variant keys animates together. See
                <code>variants-propagation</code> for that.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'variants-basic-default',
                label: 'Default.svelte',
                ...manifest['variants-basic/demos/Default.svelte']
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
