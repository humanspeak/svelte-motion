<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Compass, MoveRight, RotateCw, Share2, Spline, Waypoints } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import ArcDefault from '$lib/examples/arc/demos/Default.svelte'
    import ArcLayout from '$lib/examples/arc/demos/Layout.svelte'
    import ArcRotate from '$lib/examples/arc/demos/Rotate.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'arc()' }]
    }
    if (seo) {
        seo.title = 'arc() | Svelte Motion'
        seo.description =
            'Curve keyframes and layout animations with transition.path, including tangent-following rotation.'
        seo.ogTitle = 'arc()'
        seo.h1 = { title: 'arc()', mode: 'sr-only' }
        seo.ogTagline = 'Motion that bends between the endpoints'
        seo.ogFeatures = ['transition.path', 'Keyframes', 'Tangent Rotation', 'layoutId']
        seo.ogSlug = 'examples-arc'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/arc/demos/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'PATH',
            title: { prefix: 'straight endpoints, ', accent: 'curved travel', end: '.' },
            description:
                'Click the stage to send the box between fixed endpoints. Strength controls the bend while direction can stay automatic or lock clockwise/counter-clockwise.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'arc()' },
                { k: 'input', v: 'transition.path' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}Default.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'ROTATE',
            title: { prefix: 'path tangent, ', accent: 'visible heading', end: '.' },
            description:
                'The arrow follows the curve and rotates with its tangent. Path rotation uses a separate channel, so authored rotate values stay additive.',
            snippet: rotateSection,
            codeSnippet: rotateCode,
            notes: rotateNotes,
            barCells: [
                { k: 'api', v: 'arc()' },
                { k: 'input', v: 'transition.path' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}Rotate.svelte`
        },
        {
            figId: 'FIG-003',
            tag: 'LAYOUT',
            title: { prefix: 'shared element, ', accent: 'curved FLIP', end: '.' },
            description:
                'A single layoutId bubble swaps between two slots. transition.layout.path bends the projection animation without changing the destination layout.',
            snippet: layoutSection,
            codeSnippet: layoutCode,
            notes: layoutNotes,
            barCells: [
                { k: 'api', v: 'arc()' },
                { k: 'input', v: 'transition.layout.path' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}Layout.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <ArcDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Spline />
            <span
                ><code>arc()</code> replaces straight x/y interpolation with a quadratic bend.</span
            >
        </li>
        <li>
            <Compass />
            <span>Auto direction remembers a stable screen-space side across reversals.</span>
        </li>
        <li>
            <MoveRight />
            <span>The endpoints stay exact; only the route between them changes.</span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[demoCodeSample('arc/demos/Default.svelte', 'arc-keyframes', 'Default.svelte')]}
        columns={1}
    />
{/snippet}

{#snippet rotateSection()}
    <ArcRotate />
{/snippet}
{#snippet rotateNotes()}
    <ul>
        <li>
            <RotateCw />
            <span><code>rotate: true</code> follows the full path tangent.</span>
        </li>
        <li>
            <Waypoints />
            <span>A value from <code>0</code> to <code>1</code> scales the tangent rotation.</span>
        </li>
        <li>
            <Spline />
            <span>Path rotation is additive to the element's own <code>rotate</code> channel.</span>
        </li>
    </ul>
{/snippet}
{#snippet rotateCode()}
    <CodeReferenceV2
        samples={[demoCodeSample('arc/demos/Rotate.svelte', 'arc-rotate', 'Rotate.svelte')]}
        columns={1}
    />
{/snippet}

{#snippet layoutSection()}
    <ArcLayout />
{/snippet}
{#snippet layoutNotes()}
    <ul>
        <li>
            <Share2 />
            <span>The same path works for shared <code>layoutId</code> transitions.</span>
        </li>
        <li>
            <Spline />
            <span>Place it at <code>transition.layout.path</code> to configure FLIP motion.</span>
        </li>
        <li>
            <MoveRight />
            <span>Layout shifts under 20px stay straight to avoid a noisy detour.</span>
        </li>
    </ul>
{/snippet}
{#snippet layoutCode()}
    <CodeReferenceV2
        samples={[demoCodeSample('arc/demos/Layout.svelte', 'arc-layout', 'Layout.svelte')]}
        columns={1}
    />
{/snippet}

{#each sections as section, index (section.figId)}
    <ExampleV2
        figId={section.figId}
        tag={section.tag}
        title={section.title}
        description={section.description}
        mode={section.mode ?? 'live'}
        sheetLabel={formatSheetLabel(index, sections.length)}
        barCells={section.barCells}
        sourceUrl={section.sourceUrl}
        codeSnippet={section.codeSnippet}
        codeLabel="show code"
        notes={section.notes}
    >
        {@render section.snippet()}
    </ExampleV2>
{/each}
