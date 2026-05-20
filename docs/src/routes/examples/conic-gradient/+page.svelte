<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { MousePointer2, Palette, Wand2 } from '@lucide/svelte'
    import type { Snippet } from 'svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import ConicGradientDefault from '$lib/examples/conic-gradient/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Conic Gradient' }
        ]
    }
    if (seo) {
        seo.title = 'Conic Gradient | Examples | Svelte Motion'
        seo.description =
            'Pointer-tracking conic gradient example using Svelte Motion useTransform and writable stores.'
        seo.ogTitle = 'Conic Gradient'
        seo.ogTagline = 'Pointer-tracking conic gradient example using Svelte Motion useTransform'
        seo.ogFeatures = ['Pointer Tracking', 'useTransform', 'Writable Stores', 'CSS Gradients']
        seo.ogSlug = 'examples-conic-gradient'
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
            tag: 'USETRANSFORM',
            title: { prefix: 'pointer-tracking ', accent: 'gradient', end: '.' },
            description:
                'Move the cursor across the swatch. Two writable stores track the pointer position; `useTransform` derives the `conic-gradient(...)` background string from them; `styleString` paints it onto the inline style.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'derived-style' }],
            sourceUrl: `${SOURCE_URL}conic-gradient/demos/Default.svelte`
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

{#snippet defaultSection()}
    <ConicGradientDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <MousePointer2 />
            <span>
                Two writable stores (<code>gradientX</code>, <code>gradientY</code>) hold the
                pointer's normalised position. <code>onpointermove</code> writes to them; the derived
                background re-evaluates synchronously.
            </span>
        </li>
        <li>
            <Wand2 />
            <span>
                <code>useTransform(fn, deps)</code> returns a derived motion value that recomputes
                whenever any dep store changes. The fn produces the full
                <code>conic-gradient(...)</code> string by interpolating store values into a template
                literal.
            </span>
        </li>
        <li>
            <Palette />
            <span>
                <code>styleString</code> serialises the derived value object onto the inline
                <code>style</code> attribute. Re-evaluates every time
                <code>$background</code> emits, keeping the gradient in lockstep with the pointer.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'conic-gradient-default',
                label: 'Default.svelte',
                ...manifest['conic-gradient/demos/Default.svelte']
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
