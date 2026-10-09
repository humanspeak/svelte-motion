<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import {
        ArrowLeftRight,
        Crosshair,
        Layers,
        MousePointerClick,
        Shuffle,
        SlidersHorizontal,
        Square,
        Zap
    } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import AnimateLayoutSharedUnderlineTabs from '$lib/examples/animate-layout/demos/SharedUnderlineTabs.svelte'
    import AnimateLayoutShuffleGrid from '$lib/examples/animate-layout/demos/ShuffleGrid.svelte'
    import AnimateLayoutToggleSwitch from '$lib/examples/animate-layout/demos/ToggleSwitch.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'animateLayout' }
        ]
    }
    if (seo) {
        seo.title = 'animateLayout | Svelte Motion'
        seo.description =
            'Layout animations on plain elements with animateLayout — a switch knob, a shared tab underline, and a shuffled grid, no motion components.'
        seo.ogTitle = 'animateLayout'
        seo.h1 = { title: 'animateLayout', mode: 'sr-only' }
        seo.ogTagline = 'Layout animations for plain elements, no motion components'
        seo.ogFeatures = [
            'data-layout Attributes',
            'Shared Elements',
            'Scoped Updates',
            'Spring Timing'
        ]
        seo.ogSlug = 'examples-animate-layout'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'POSITION',
            title: { prefix: 'a switch knob on ', accent: 'data-layout', end: '.' },
            description:
                'The knob is a plain element tagged data-layout. Flipping the switch changes justify-content inside animateLayout, and the knob springs from its old position to its new one.',
            snippet: toggleSection,
            codeSnippet: toggleCode,
            notes: toggleNotes,
            barCells: [{ k: 'attr', v: 'data-layout' }],
            sourceUrl: `${SOURCE_URL}animate-layout/demos/ToggleSwitch.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'SHARED',
            title: { prefix: 'a tab underline that ', accent: 'travels', end: '.' },
            description:
                'Only the selected tab renders the highlight and underline. Elements sharing a data-layout-id hand off across the update, and .shared() gives the underline a springier transition than the highlight.',
            snippet: sharedSection,
            codeSnippet: sharedCode,
            notes: sharedNotes,
            barCells: [{ k: 'attr', v: 'data-layout-id' }],
            sourceUrl: `${SOURCE_URL}animate-layout/demos/SharedUnderlineTabs.svelte`
        },
        {
            figId: 'FIG-003',
            tag: 'REORDER',
            title: { prefix: 'shuffling a ', accent: 'keyed grid', end: '.' },
            description:
                'Reordering a keyed each block moves the existing tile nodes; animateLayout, scoped to the grid, slides every tile from its old slot to its new one.',
            snippet: shuffleSection,
            codeSnippet: shuffleCode,
            notes: shuffleNotes,
            barCells: [{ k: 'scope', v: 'grid' }],
            sourceUrl: `${SOURCE_URL}animate-layout/demos/ShuffleGrid.svelte`
        }
    ]
</script>

{#snippet toggleSection()}
    <AnimateLayoutToggleSwitch />
{/snippet}
{#snippet toggleNotes()}
    <ul>
        <li>
            <MousePointerClick />
            <span>
                <code>animateLayout(update)</code> measures every tagged element, runs the update —
                Svelte
                <code>$state</code> mutations are flushed synchronously, so plain assignment works — then
                animates each element from its old box to its new one.
            </span>
        </li>
        <li>
            <Crosshair />
            <span>
                The knob only moves, so <code>data-layout</code> and
                <code>data-layout="position"</code>
                look identical here. Use <code>"position"</code> or <code>"size"</code> to animate one
                axis of the change and snap the other.
            </span>
        </li>
        <li>
            <Zap />
            <span>
                Clicking again mid-flight interrupts the spring and continues from the knob's
                current position — no jump back to the start.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet toggleCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'animate-layout/demos/ToggleSwitch.svelte',
                'animate-layout-toggle-switch',
                'ToggleSwitch.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet sharedSection()}
    <AnimateLayoutSharedUnderlineTabs />
{/snippet}
{#snippet sharedNotes()}
    <ul>
        <li>
            <ArrowLeftRight />
            <span>
                Svelte removes the old highlight and underline and mounts new ones under the
                selected tab. Because they share a <code>data-layout-id</code>, each new element
                animates from the old one's position and size.
            </span>
        </li>
        <li>
            <SlidersHorizontal />
            <span>
                <code>.shared('tab-underline', transition)</code> overrides the transition for one id
                — the underline springs while the highlight uses the default 0.25s ease.
            </span>
        </li>
        <li>
            <Square />
            <span>
                Both elements have square corners: plain elements have no tracked
                <code>border-radius</code>, so a rounded element that changes size would stretch its
                corners mid-animation.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet sharedCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'animate-layout/demos/SharedUnderlineTabs.svelte',
                'animate-layout-shared-underline-tabs',
                'SharedUnderlineTabs.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet shuffleSection()}
    <AnimateLayoutShuffleGrid />
{/snippet}
{#snippet shuffleNotes()}
    <ul>
        <li>
            <Shuffle />
            <span>
                A keyed <code>each</code> block reorders the existing DOM nodes instead of recreating
                them, so each tile keeps its identity and animates between grid slots.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                Passing the grid as the first argument scopes the call: only tagged elements inside
                it are measured, so the other demos on this page never animate from a shuffle.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet shuffleCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'animate-layout/demos/ShuffleGrid.svelte',
                'animate-layout-shuffle-grid',
                'ShuffleGrid.svelte'
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
