<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Activity, Layers, Pointer } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import UseFollowValueDefault from '$lib/examples/use-follow-value/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'useFollowValue' }
        ]
    }
    if (seo) {
        seo.title = 'useFollowValue | Svelte Motion'
        seo.description =
            'Six follower motion values driven by a single pointer source — each with a different transition (spring variants and tweens) so the trail visually shows how each animation type feels.'
        seo.ogTitle = 'useFollowValue'
        seo.h1 = { title: 'useFollowValue', mode: 'sr-only' }
        seo.ogTagline = 'One source, six personalities'
        seo.ogFeatures = ['Spring', 'Tween', 'Wobble', 'Mixed types']
        seo.ogSlug = 'examples-use-follow-value'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'HOOK',
            title: { prefix: 'one source, ', accent: 'six personalities', end: '.' },
            description:
                'A single pointer-position `MotionValue` drives six `useFollowValue` outputs. Each follower has a different transition (spring crisp/bouncy/floaty/wobbly, tween short/long) so the comet trail visually shows how each animation type behaves under the same input.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'mixed-transition follow' }],
            sourceUrl: `${SOURCE_URL}use-follow-value/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <UseFollowValueDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Pointer />
            <span>
                The two source motion values (<code>targetX</code>, <code>targetY</code>) are plain
                <code>useMotionValue</code> instances driven directly from the
                <code>pointermove</code> handler. Every follower derives from these — no per-follower
                event wiring.
            </span>
        </li>
        <li>
            <Activity />
            <span>
                Each follower is a separate <code>useFollowValue(source, options)</code> call. The
                <code>options.type</code> is the only thing that differs — same source, different
                physics. That's the entire selling point of the hook: pick the personality, get a
                composable <code>MotionValue</code> back.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                Layer with <code>mix-blend-mode: screen</code> + a soft <code>box-shadow</code> per follower
                so the colours add up where they overlap — the same trick framer-motion's docs use to
                make the trail legible. The animation is real; only the visual treatment is decorative.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'use-follow-value/demos/Default.svelte',
                'use-follow-value-default',
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
