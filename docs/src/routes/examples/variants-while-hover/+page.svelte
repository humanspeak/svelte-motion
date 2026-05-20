<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { Code2, KeyRound, Layers, Repeat2 } from '@lucide/svelte'
    import type { Snippet } from 'svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import InlineForm from '$lib/examples/variants-while-hover/demos/InlineForm.svelte'
    import VariantKey from '$lib/examples/variants-while-hover/demos/VariantKey.svelte'
    // The manifest is generated at build/dev start by `demoManifestPlugin`
    // (registered in vite.config.ts). Each entry's key is the demo file's
    // path relative to `src/lib/examples/`. Editing any demo file
    // regenerates the manifest and Vite reloads the page — the rendered
    // demo and the displayed code stay in lockstep with zero per-page
    // bookkeeping.
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'whileHover variant keys' }
        ]
    }
    if (seo) {
        seo.title =
            'whileHover variant keys — reuse variants across gestures | Examples | Svelte Motion'
        seo.description =
            'Pass a variant key (or array) to whileHover, whileTap, whileFocus, whileDrag, or whileInView to reuse named animation states across gestures.'
        seo.ogTitle = 'whileHover variant keys'
        seo.ogTagline = 'Reuse named variants across gesture props'
        seo.ogFeatures = ['Variants', 'whileHover', 'whileTap', 'String keys']
        seo.ogSlug = 'examples-variants-while-hover'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    // ── Sheet configuration ────────────────────────────────────────────
    // One row per sheet section. Each row carries lede words for the left
    // column and references the demo file in the manifest — the demo
    // component is mounted as the body, and the manifest entry is fed
    // through CodeReferenceV2 as the toggleable code panel.
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
            tag: 'INLINE',
            title: { prefix: 'inline ', accent: 'keyframes', end: '.' },
            description:
                'Pass an object directly to whileHover / whileTap. Right for one-off interactions — the animation is co-located with the element that uses it.',
            snippet: inlineFormSection,
            codeSnippet: inlineFormCode,
            notes: inlineFormNotes,
            barCells: [{ k: 'form', v: 'inline-keyframes' }],
            sourceUrl: `${SOURCE_URL}variants-while-hover/demos/InlineForm.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'VARIANT',
            title: { prefix: 'variant ', accent: 'key', end: '.' },
            description:
                'Name the state on `variants`, reference it by string from any gesture prop. The same `"hovered"` key drives `whileHover`, and could just as easily drive `whileFocus`, `whileDrag`, or `whileInView`.',
            snippet: variantKeySection,
            codeSnippet: variantKeyCode,
            notes: variantKeyNotes,
            barCells: [{ k: 'form', v: 'variant-key' }],
            sourceUrl: `${SOURCE_URL}variants-while-hover/demos/VariantKey.svelte`
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

{#snippet inlineFormSection()}
    <InlineForm />
{/snippet}
{#snippet inlineFormNotes()}
    <ul>
        <li>
            <Code2 />
            <span>
                Best for one-off interactions where the animation only applies to a single element
                and won't be reused.
            </span>
        </li>
        <li>
            <Repeat2 />
            <span>
                Repeat the object on every element if you need the same animation in multiple places
                — that duplication is the smell that pushes you toward the variant-key form below.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet inlineFormCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'inline-form',
                label: 'InlineForm.svelte',
                ...manifest['variants-while-hover/demos/InlineForm.svelte']
            }
        ]}
        columns={1}
    />
{/snippet}

{#snippet variantKeySection()}
    <VariantKey />
{/snippet}
{#snippet variantKeyNotes()}
    <ul>
        <li>
            <Layers />
            <span>
                Define the state once on <code>variants</code>; any gesture prop on the same element
                (or its descendants) can pull from the same map by key.
            </span>
        </li>
        <li>
            <KeyRound />
            <span>
                Works with <code>whileHover</code>, <code>whileTap</code>,
                <code>whileFocus</code>, <code>whileDrag</code>, and <code>whileInView</code>. Pass
                a single string or an array of keys (later entries override earlier ones).
            </span>
        </li>
    </ul>
{/snippet}
{#snippet variantKeyCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'variant-key',
                label: 'VariantKey.svelte',
                ...manifest['variants-while-hover/demos/VariantKey.svelte']
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
