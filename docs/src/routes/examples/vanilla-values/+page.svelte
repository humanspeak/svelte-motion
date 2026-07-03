<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Blend, Signal, Unplug } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import VanillaDefault from '$lib/examples/vanilla-values/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Vanilla Values' }
        ]
    }
    if (seo) {
        seo.title = 'Vanilla Values | Examples | Svelte Motion'
        seo.description =
            'Motion values without motion components — a $state slider driving a plain div through toMotionValue, mapValue, springValue, and styleEffect.'
        seo.ogTitle = 'Vanilla Values'
        seo.h1 = { title: 'Vanilla Values', mode: 'sr-only' }
        seo.ogTagline = 'Motion values on plain elements — no components needed'
        seo.ogFeatures = ['Rune Bridge', 'Color Mapping', 'Spring Physics', 'styleEffect']
        seo.ogSlug = 'examples-vanilla-values'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'VANILLA',
            title: { prefix: 'motion values on ', accent: 'plain elements', end: '.' },
            description:
                'No motion components anywhere: a $state slider feeds toMotionValue, mapValue derives position and color, springValue smooths them, and styleEffect binds the result to a plain div.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'rune-bridge' }],
            sourceUrl: `${SOURCE_URL}vanilla-values/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <VanillaDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Unplug />
            <span>
                <code>toMotionValue(() => slider / 100)</code> is the rune bridge — reads of
                <code>$state</code> inside the getter are tracked, so plain Svelte state drives the
                whole motion-value chain. Everything here works in module scope or a
                <code>.svelte.ts</code> store too.
            </span>
        </li>
        <li>
            <Blend />
            <span>
                <code>mapValue</code> mixes COLOR stops as happily as numbers — one spring-smoothed
                progress value drives position, <code>backgroundColor</code>, and a tinted
                <code>boxShadow</code> through three-stop ranges.
            </span>
        </li>
        <li>
            <Signal />
            <span>
                <code>styleEffect</code> binds the values straight to a plain
                <code>&lt;div&gt;</code> — updates run on Motion's frame loop, outside Svelte's
                render cycle. The unbind function and <code>.destroy()</code> calls in the
                <code>$effect</code> cleanups are the manual lifecycle vanilla values ask for.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'vanilla-values/demos/Default.svelte',
                'vanilla-values-default',
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
