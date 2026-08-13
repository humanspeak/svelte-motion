<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Gauge, Route, Signal, Sparkles, Wand } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import SvgAnimationDefault from '$lib/examples/svg-animation/demos/Default.svelte'
    import SignalDock from '$lib/examples/svg-animation/demos/SignalDock.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'SVG Animation' }
        ]
    }
    if (seo) {
        seo.title = 'SVG Animation | Svelte Motion'
        seo.description =
            'Bind MotionValues to SVG attributes and commit exact final styles after accelerated animation.'
        seo.ogTitle = 'SVG Animation'
        seo.h1 = { title: 'SVG Animation', mode: 'sr-only' }
        seo.ogTagline = 'MotionValues bound straight to SVG attributes'
        seo.ogFeatures = ['SVG', 'MotionValue', 'Accelerated styles', 'useReducedMotion']
        seo.ogSlug = 'examples-svg-animation'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'SVG',
            title: { prefix: 'one spring, ', accent: 'three attributes', end: '.' },
            description:
                'A single useSpring drives the ring’s stroke-dashoffset, the dot’s cx, and the line’s x2. No keyframes and no re-render: Motion subscribes to the value and renders every bound value as an SVG presentation attribute — the same channel React Framer Motion uses.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'motion.circle' },
                { k: 'input', v: 'useSpring' },
                { k: 'channel', v: 'attribute' }
            ],
            sourceUrl: `${SOURCE_URL}svg-animation/demos/Default.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'MOTION 13',
            title: { prefix: 'launch bright, ', accent: 'land exact', end: '.' },
            description:
                'Motion 12.43 introduced accelerated SVG style animations; Motion 13 fixed their final-style restore. A luminous vector packet crosses a compositor-friendly transform track, blooms at its dock, and fades to a committed final state. Live telemetry reports the browser’s actual opacity, transform, and fill so replay and reverse make stale CSS impossible to miss.',
            snippet: signalDockSection,
            codeSnippet: signalDockCode,
            notes: signalDockNotes,
            barCells: [
                { k: 'wow', v: 'signal dock' },
                { k: 'proof', v: 'computed style' },
                { k: 'a11y', v: 'reduced motion' }
            ],
            sourceUrl: `${SOURCE_URL}svg-animation/demos/SignalDock.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <SvgAnimationDefault />
{/snippet}
{#snippet signalDockSection()}
    <SignalDock />
{/snippet}
{#snippet signalDockNotes()}
    <ul>
        <li>
            <Sparkles />
            <span>
                The WOW moment is the signal’s luminous dock: it travels, changes fill, disappears,
                and leaves a bloom precisely on the marked destination.
            </span>
        </li>
        <li>
            <Gauge />
            <span>
                Telemetry reads <em>computed</em> opacity, transform, and fill from the SVG node—not merely
                the intended animation state. Opacity and transform are the accelerated CSS channels;
                fill is an SVG paint attribute shown alongside them, not an acceleration claim.
            </span>
        </li>
        <li>
            <Wand />
            <span>
                Replay and reverse exercise both final-style commits; reduced-motion users get the
                same states without the travel animation.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet signalDockCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'svg-animation/demos/SignalDock.svelte',
                'svg-animation-signal-dock',
                'SignalDock.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Signal />
            <span>
                One <code>useSpring</code> feeds every bound attribute through
                <code>useTransform</code>, so they stay in lockstep.
            </span>
        </li>
        <li>
            <Route />
            <span>
                Every bound value — <code>cx</code>, <code>stroke-dashoffset</code>,
                <code>x2</code> — is written as a presentation attribute via
                <code>setAttribute</code>: one MotionValue, one channel.
            </span>
        </li>
        <li>
            <Wand />
            <span>
                That is exactly how React Framer Motion renders SVG, so cascade behavior (author CSS
                beats presentation attributes) matches upstream too.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'svg-animation/demos/Default.svelte',
                'svg-animation-default',
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
