<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Boxes, GitBranchPlus, Hand } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import VariantsDynamicDefault from '$lib/examples/variants-dynamic/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Variants Dynamic (custom)' }
        ]
    }
    if (seo) {
        seo.title = 'Variants Dynamic — custom prop | Examples | Svelte Motion'
        seo.description =
            'Per-instance variants using the custom prop and function-form factories in Svelte Motion. Staggered list reveals with index-driven delays.'
        seo.ogTitle = 'Variants Dynamic (custom)'
        seo.ogTagline = 'Per-instance variants using the custom prop and function-form factories'
        seo.ogFeatures = ['Variants', 'custom prop', 'Staggered list', 'Function-form variants']
        seo.ogSlug = 'examples-variants-dynamic'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'VARIANTS',
            title: { prefix: 'function-form ', accent: 'variants', end: '.' },
            description:
                'Seven cards. One `variants` map with three function-form states (`fanned`, `exploded`, `stacked`). Each card resolves the active state by passing its own index in via `custom={i}` — per-instance values without writing seven keyframe blocks.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'dynamic variants' }],
            sourceUrl: `${SOURCE_URL}variants-dynamic/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <VariantsDynamicDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <GitBranchPlus />
            <span>
                Each variant value is a function — <code>(i) => keyframes</code> — instead of a
                literal object. The function receives whatever the motion component's
                <code>custom</code> prop holds, and resolves at evaluation time.
            </span>
        </li>
        <li>
            <Boxes />
            <span>
                <code>custom={`{i}`}</code> on each card forwards its array index into the variant
                function. <code>x: offset * 22</code>, <code>rotate: offset * 9</code>, etc. become
                per-card values; the variants map stays a single source of truth.
            </span>
        </li>
        <li>
            <Hand />
            <span>
                Hovering a card raises it via <code>whileHover</code> — a plain object since hover
                doesn't need <code>custom</code>. Function and object form variants co-exist in the
                same map.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'variants-dynamic/demos/Default.svelte',
                'variants-dynamic-default',
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
