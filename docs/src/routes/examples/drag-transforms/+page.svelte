<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Axis3d, Box, Hand, Layers, MousePointer2, RotateCw } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import DragTransformsAngled from '$lib/examples/drag-transforms/demos/Angled.svelte'
    import DragTransformsPerspective from '$lib/examples/drag-transforms/demos/Perspective.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Drag Transforms' }
        ]
    }
    if (seo) {
        seo.title = 'Drag Transforms | Svelte Motion'
        seo.description =
            'Drag a card that stays angled and tilts in 3D — translation composes with authored rotate, skew, perspective, and whileDrag channels.'
        seo.ogTitle = 'Drag Transforms'
        seo.h1 = { title: 'Drag Transforms', mode: 'sr-only' }
        seo.ogTagline = 'Drag translation composed with rotate, skew, and perspective'
        seo.ogFeatures = ['Drag', 'Rotate', 'Skew', 'Perspective']
        seo.ogSlug = 'examples-drag-transforms'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'DRAG',
            title: { prefix: 'angled ', accent: 'drag composition', end: '.' },
            description:
                'The card rests at an authored angle. Dragging translates it without flattening that angle — the drag translation is composed into the same transform as the authored rotate and skew, rather than replacing it.',
            snippet: angledSection,
            codeSnippet: angledCode,
            notes: angledNotes,
            barCells: [{ k: 'channels', v: 'rotate · skewX · whileDrag' }],
            sourceUrl: `${SOURCE_URL}drag-transforms/demos/Angled.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'DRAG',
            title: { prefix: 'perspective ', accent: 'tilt on grab', end: '.' },
            description:
                'A 3D variant: grabbing the card tilts it on both axes under a transformPerspective, and it keeps tilting while it tracks the pointer. The perspective and rotation survive every live drag frame.',
            snippet: perspectiveSection,
            codeSnippet: perspectiveCode,
            notes: perspectiveNotes,
            barCells: [{ k: 'channels', v: 'transformPerspective · rotateX · rotateY' }],
            sourceUrl: `${SOURCE_URL}drag-transforms/demos/Perspective.svelte`
        }
    ]
</script>

{#snippet angledSection()}
    <DragTransformsAngled />
{/snippet}
{#snippet angledNotes()}
    <ul>
        <li>
            <RotateCw />
            <span>
                The resting angle is authored as transform channels — <code>rotate</code> and
                <code>skewX</code> on <code>style</code> — not as a raw CSS
                <code>transform</code> string.
            </span>
        </li>
        <li>
            <Hand />
            <span>
                Grab and drag. The card keeps its angle the whole way: drag translation is written
                into the same composed transform instead of overwriting it.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                <code>whileDrag</code> layers a second <code>rotate</code> on top for the duration of
                the gesture, which takes over the channel while the pointer is down and hands it back
                on release.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet angledCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'drag-transforms/demos/Angled.svelte',
                'drag-transforms-angled',
                'Angled.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet perspectiveSection()}
    <DragTransformsPerspective />
{/snippet}
{#snippet perspectiveNotes()}
    <ul>
        <li>
            <Box />
            <span>
                <code>transformPerspective</code> is set on the card itself, so the tilt reads as
                depth without needing a <code>perspective</code> wrapper around the stage.
            </span>
        </li>
        <li>
            <Axis3d />
            <span>
                <code>whileDrag</code> applies <code>rotateX</code> and <code>rotateY</code> together.
                Both 3D channels stay composed with the live translation for every frame of the drag.
            </span>
        </li>
        <li>
            <MousePointer2 />
            <span>
                Release and the spring returns the card to flat while it settles back inside the
                bounds — the tilt unwinds instead of snapping.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet perspectiveCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'drag-transforms/demos/Perspective.svelte',
                'drag-transforms-perspective',
                'Perspective.svelte'
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
