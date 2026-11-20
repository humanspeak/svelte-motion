<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Gauge, Repeat, Scale, Square, Timer, Weight } from '@lucide/svelte'
    import { demoCodeSample } from '#lib/demo-loaders.js'
    import { getBreadcrumbContext } from '#lib/components/contexts/Breadcrumb/Breadcrumb.context.js'
    import { getSeoContext } from '#lib/components/contexts/Seo/Seo.context.js'
    import AutoMass from '#lib/examples/layout-velocity/demos/AutoMass.svelte'
    import InterruptedSpring from '#lib/examples/layout-velocity/demos/InterruptedSpring.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Layout velocity' }
        ]
    }
    if (seo) {
        seo.title = 'Layout velocity & mass auto | Svelte Motion'
        seo.description =
            'Interrupt a spring layout animation and it keeps its speed, and size a layout spring with mass: "auto" so bigger elements move heavier.'
        seo.ogTitle = 'Layout velocity & mass auto'
        seo.h1 = { title: 'Layout velocity & mass auto', mode: 'sr-only' }
        seo.ogTagline = 'Layout springs that keep their momentum'
        seo.ogFeatures = ['Layout', 'Spring velocity', 'mass: auto', 'Motion Parity']
        seo.ogSlug = 'examples-layout-velocity'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'LAYOUT',
            title: {
                prefix: 'interrupt a layout spring, ',
                accent: 'it keeps its speed',
                end: '.'
            },
            description:
                'Click Toggle twice, quickly. The spring puck swings round and heads back at the speed it was already moving, while the tween puck stops dead and turns, because a tween always starts the next layout animation from rest.',
            snippet: interruptSection,
            codeSnippet: interruptCode,
            notes: interruptNotes,
            barCells: [
                { k: 'api', v: 'layout' },
                { k: 'input', v: "type: 'spring'" },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}layout-velocity/demos/InterruptedSpring.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'LAYOUT',
            title: { prefix: 'mass from size, ', accent: 'bigger moves heavier', end: '.' },
            description:
                "Both tiles move by the same distance on the same spring. With `mass: 'auto'` the large tile is heavier, so it lags and settles later while the small one snaps over; with the default mass of 1 they move in lockstep.",
            snippet: massSection,
            codeSnippet: massCode,
            notes: massNotes,
            barCells: [
                { k: 'api', v: 'layout' },
                { k: 'input', v: "mass: 'auto'" },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}layout-velocity/demos/AutoMass.svelte`
        }
    ]
</script>

{#snippet interruptSection()}
    <InterruptedSpring />
{/snippet}
{#snippet interruptNotes()}
    <ul>
        <li>
            <Gauge />
            <span>
                A layout transition with <code>type: 'spring'</code> and <code>visualDuration</code>
                / <code>bounce</code> or <code>stiffness</code> / <code>damping</code> carries its velocity
                into the next layout animation (Motion 14.13).
            </span>
        </li>
        <li>
            <Timer />
            <span>
                A tween, including the default layout transition, and a spring set with
                <code>duration</code> start from rest, so they end on time.
            </span>
        </li>
        <li>
            <Repeat />
            <span>
                Any transition with <code>repeat</code> also starts from rest.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet interruptCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'layout-velocity/demos/InterruptedSpring.svelte',
                'layout-velocity-interrupted-spring',
                'InterruptedSpring.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet massSection()}
    <AutoMass />
{/snippet}
{#snippet massNotes()}
    <ul>
        <li>
            <Square />
            <span>
                A 300 px square has mass 1. Mass follows the square root of width × height, between
                0.25 and 2.
            </span>
        </li>
        <li>
            <Scale />
            <span>
                Damping is scaled with mass, so the bounce stays the same and bigger elements settle
                later.
            </span>
        </li>
        <li>
            <Weight />
            <span>
                <code>"auto"</code> only has an effect in layout animations; anywhere else it behaves
                like the default mass of 1.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet massCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'layout-velocity/demos/AutoMass.svelte',
                'layout-velocity-auto-mass',
                'AutoMass.svelte'
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
