<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Hand, MousePointer, Sparkles } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import HoverAndTapDefault from '$lib/examples/hover-and-tap/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Hover and Tap' }
        ]
    }
    if (seo) {
        seo.title = 'Hover and Tap | Examples | Svelte Motion'
        seo.description =
            'Gesture-driven animations for hover and tap interactions using Svelte Motion. Create responsive, interactive elements with spring physics.'
        seo.ogTitle = 'Hover and Tap'
        seo.h1 = { title: 'Hover and Tap', mode: 'sr-only' }
        seo.ogTagline =
            'Gesture-driven animations for hover and tap interactions using Svelte Motion'
        seo.ogFeatures = ['whileHover', 'whileTap', 'Spring Physics', 'Gesture Events']
        seo.ogSlug = 'examples-hover-and-tap'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'GESTURE',
            title: { prefix: 'hover + tap ', accent: 'gestures', end: '.' },
            description:
                '`whileHover` and `whileTap` are temporary animation states that blend in while a pointer is over (or pressing) the element. Release returns to the resting state automatically.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'gesture overlay' }],
            sourceUrl: `${SOURCE_URL}hover-and-tap/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <HoverAndTapDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <MousePointer />
            <span>
                <code>whileHover</code> takes effect when the pointer enters the element and lifts
                back to <code>animate</code> when it leaves. Here it scales the square to 1.2x — a lift-and-grow
                common to clickable cards.
            </span>
        </li>
        <li>
            <Hand />
            <span>
                <code>whileTap</code> overrides <code>whileHover</code> while the pointer (or touch) is
                held down — scale 0.8 reads as a press. Release re-applies hover until the pointer leaves.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                These overlays compose without any state plumbing — no
                <code>$state</code> flag, no event handlers. Same idea works for opacity, rotation, colour,
                or any animatable prop.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'hover-and-tap/demos/Default.svelte',
                'hover-and-tap-default',
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
