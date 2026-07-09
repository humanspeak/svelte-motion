<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Route, Signal, Wand } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import SvgAnimationDefault from '$lib/examples/svg-animation/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'SVG Animation' }
        ]
    }
    if (seo) {
        seo.title = 'SVG Animation | Examples | Svelte Motion'
        seo.description = 'Bind MotionValues straight to SVG presentation attributes.'
        seo.ogTitle = 'SVG Animation'
        seo.h1 = { title: 'SVG Animation', mode: 'sr-only' }
        seo.ogTagline = 'MotionValues bound straight to SVG attributes'
        seo.ogFeatures = ['SVG', 'MotionValue', 'useSpring', 'useTransform']
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
                'A single useSpring drives the ring’s stroke-dashoffset, the dot’s cx, and the line’s x2. No keyframes and no re-render: Motion subscribes to the value and writes each attribute on the channel it belongs to.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'motion.circle' },
                { k: 'input', v: 'useSpring' },
                { k: 'channels', v: 'style + attribute' }
            ],
            sourceUrl: `${SOURCE_URL}svg-animation/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <SvgAnimationDefault />
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
                <code>cx</code> and <code>stroke-dashoffset</code> are CSS properties, so they are
                written to <code>element.style</code>.
            </span>
        </li>
        <li>
            <Wand />
            <span>
                <code>x2</code> is not a CSS property, so it is written with
                <code>setAttribute</code> — same value, different channel.
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
