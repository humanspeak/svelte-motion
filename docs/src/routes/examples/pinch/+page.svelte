<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Hand, Magnet, RotateCw, Ruler, Scaling, SquareCode, Undo2 } from '@lucide/svelte'
    import { demoCodeSample } from '#lib/demo-loaders.js'
    import { getBreadcrumbContext } from '#lib/components/contexts/Breadcrumb/Breadcrumb.context.js'
    import { getSeoContext } from '#lib/components/contexts/Seo/Seo.context.js'
    import PinchPhoto from '#lib/examples/pinch/demos/Photo.svelte'
    import PinchLimits from '#lib/examples/pinch/demos/Limits.svelte'
    import PinchVanilla from '#lib/examples/pinch/demos/Vanilla.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'Pinch' }]
    }
    if (seo) {
        seo.title = 'Pinch | Svelte Motion'
        seo.description =
            'Pinch to zoom, rotate and move an element, with elastic limits and rotation snapping.'
        seo.ogTitle = 'Pinch'
        seo.h1 = { title: 'Pinch', mode: 'sr-only' }
        seo.ogTagline = 'Pinch to zoom, twist and move'
        seo.ogFeatures = ['pinch', 'whilePinch', 'pinch()', 'Motion Parity']
        seo.ogSlug = 'examples-pinch'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'GESTURE',
            title: { prefix: 'pinch to zoom and ', accent: 'twist', end: '.' },
            description:
                'Pinch the card to zoom between 1x and 4x and twist it, and drag to move it. Past its limits it resists and springs back; on release its rotation snaps to the nearest 90°. Trackpad: pinch. Touch: pinch and twist with two fingers. Mouse: hold ctrl and scroll.',
            snippet: photoSection,
            codeSnippet: photoCode,
            notes: photoNotes,
            barCells: [
                { k: 'api', v: 'pinch · drag' },
                { k: 'input', v: 'touch · trackpad' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}pinch/demos/Photo.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'LIMITS',
            title: { prefix: 'resist, stop or ', accent: 'snap back', end: '.' },
            description:
                'Three cards limited to between 0.5x and 2x. Pinch each past 2x: elastic: 0 stops dead, the default resists and springs back, and snapToOrigin returns to 1x on release.',
            snippet: limitsSection,
            codeSnippet: limitsCode,
            notes: limitsNotes,
            barCells: [
                { k: 'api', v: 'scale · elastic' },
                { k: 'input', v: 'touch · trackpad' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}pinch/demos/Limits.svelte`
        },
        {
            figId: 'FIG-003',
            tag: 'VANILLA',
            title: { prefix: 'pinch() on a ', accent: 'plain div', end: '.' },
            description:
                'No motion component and no LazyMotion: pinch() binds the gesture to a plain element, its start callback returns handlers for each pinch, and rotation snaps to 45° on release.',
            snippet: vanillaSection,
            codeSnippet: vanillaCode,
            notes: vanillaNotes,
            barCells: [
                { k: 'api', v: 'pinch()' },
                { k: 'input', v: 'touch · trackpad' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}pinch/demos/Vanilla.svelte`
        }
    ]
</script>

{#snippet photoSection()}
    <PinchPhoto />
{/snippet}
{#snippet photoNotes()}
    <ul>
        <li>
            <Hand />
            <span>
                <code>pinch</code> needs <code>pinchFeatures</code> in a <code>LazyMotion</code>, on
                <code>motion.*</code> components too.
            </span>
        </li>
        <li>
            <Scaling />
            <span>
                <code>scale: &#123; min: 1, max: 4 &#125;</code> resists past the limits and springs back
                on release.
            </span>
        </li>
        <li>
            <RotateCw />
            <span
                ><code>rotate: &#123; snap: 90 &#125;</code> rotates to the nearest 90° on release.</span
            >
        </li>
    </ul>
{/snippet}
{#snippet photoCode()}
    <CodeReferenceV2
        samples={[demoCodeSample('pinch/demos/Photo.svelte', 'pinch-photo', 'Photo.svelte')]}
        columns={1}
    />
{/snippet}

{#snippet limitsSection()}
    <PinchLimits />
{/snippet}
{#snippet limitsNotes()}
    <ul>
        <li>
            <Ruler />
            <span><code>elastic: 0</code> stops at the limit; <code>1</code> doesn't resist.</span>
        </li>
        <li>
            <Magnet />
            <span>The default, <code>0.35</code>, resists past the limit and springs back.</span>
        </li>
        <li>
            <Undo2 />
            <span>
                <code>snapToOrigin</code> animates scale to 1, and rotation and x/y to 0, on release.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet limitsCode()}
    <CodeReferenceV2
        samples={[demoCodeSample('pinch/demos/Limits.svelte', 'pinch-limits', 'Limits.svelte')]}
        columns={1}
    />
{/snippet}

{#snippet vanillaSection()}
    <PinchVanilla />
{/snippet}
{#snippet vanillaNotes()}
    <ul>
        <li>
            <SquareCode />
            <span>
                <code>pinch(element, onPinchStart, options)</code> returns a function that removes the
                gesture.
            </span>
        </li>
        <li>
            <Hand />
            <span>
                The start callback can return an end handler, or <code
                    >&#123; onPinch, onComplete &#125;</code
                >.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet vanillaCode()}
    <CodeReferenceV2
        samples={[demoCodeSample('pinch/demos/Vanilla.svelte', 'pinch-vanilla', 'Vanilla.svelte')]}
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
