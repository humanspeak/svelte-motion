<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Hand, MoveHorizontal, RotateCcw } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import VanillaDragSliderKnob from '$lib/examples/vanilla-drag/demos/SliderKnob.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Vanilla drag()' }
        ]
    }
    if (seo) {
        seo.title = 'Vanilla drag() | Svelte Motion'
        seo.description =
            'Motion 14.4 drag() on a plain element in Svelte — a slider knob constrained to its track, reset with animate() because both share the knob’s x value.'
        seo.ogTitle = 'Vanilla drag()'
        seo.h1 = { title: 'Vanilla drag()', mode: 'sr-only' }
        seo.ogTagline = 'Drag plain elements, no motion components'
        seo.ogFeatures = ['Axis Lock', 'Element Constraints', 'Momentum', 'Shared x with animate()']
        seo.ogSlug = 'examples-vanilla-drag'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'DRAG',
            title: { prefix: 'a slider knob on a ', accent: 'plain element', end: '.' },
            description:
                'drag() makes the knob draggable on x and keeps it inside its track. Reset animates the knob home with animate(); both work on the same x value, so the next drag starts from wherever the knob is.',
            snippet: sliderSection,
            codeSnippet: sliderCode,
            notes: sliderNotes,
            barCells: [{ k: 'constraints', v: 'track' }],
            sourceUrl: `${SOURCE_URL}vanilla-drag/demos/SliderKnob.svelte`
        }
    ]
</script>

{#snippet sliderSection()}
    <VanillaDragSliderKnob />
{/snippet}
{#snippet sliderNotes()}
    <ul>
        <li>
            <MoveHorizontal />
            <span>
                <code>axis: 'x'</code> locks the knob to one axis and sets
                <code>touch-action: pan-y</code>, so a vertical swipe on a phone still scrolls the
                page.
            </span>
        </li>
        <li>
            <Hand />
            <span>
                <code>constraints: track</code> keeps the knob inside the track element. Release it with
                some speed and it glides, then settles against the edge.
            </span>
        </li>
        <li>
            <RotateCcw />
            <span>
                <code>drag()</code> and <code>animate()</code> share the knob's <code>x</code>, so
                Reset springs it home and the next drag continues from where it is.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet sliderCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'vanilla-drag/demos/SliderKnob.svelte',
                'vanilla-drag-slider-knob',
                'SliderKnob.svelte'
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
