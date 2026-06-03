<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Code2, KeyRound, Layers, Repeat2 } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import InlineForm from '$lib/examples/variants-while-hover/demos/InlineForm.svelte'
    import VariantKey from '$lib/examples/variants-while-hover/demos/VariantKey.svelte'
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
    // column and references the lazily loaded demo source for the
    // toggleable CodeReferenceV2 panel.

    const sections: ExampleSection[] = [
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
            demoCodeSample(
                'variants-while-hover/demos/InlineForm.svelte',
                'inline-form',
                'InlineForm.svelte'
            )
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
            demoCodeSample(
                'variants-while-hover/demos/VariantKey.svelte',
                'variant-key',
                'VariantKey.svelte'
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
